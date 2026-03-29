import 'dotenv/config';
import http from 'http';
import { Game, AgentConfig, GameEvent } from '../engine/game';
import { getAction as llmGetAction, getTrashTalk, resetAllFailures, isCircuitOpen } from '../adapters/llm-adapter';
import { createMockAdapter } from '../adapters/mock-adapter';
import { createOpenRouterConfig } from '../adapters/providers';
import { buildUserPrompt, buildSystemPrompt, PromptContext } from '../adapters/prompt';
import { getValidActions } from '../engine/betting';
import { analyzeHandStrength, type HandStrengthInfo } from '../engine/hand-eval';
import { BuffSystem } from '../engine/buffs';
import { ScoutingSystem } from '../engine/scouting';
import { StrategyJournal } from '../engine/strategy';
import { generateReactions, buildHandNarrative, type ReactionContext, type Reaction } from '../engine/reactions';
import { type TrashTalkContext } from '../adapters/prompt';
import { WebSocketManager } from './websocket';
import { StateManager } from './state-manager';
import type { AgentAction, AgentThought, GameState, PlayerState, ValidActions, InternalPlayer } from '../engine/types';

// ---- Agent definitions ----

const AGENT_PERSONALITIES: Record<string, { personality: string }> = {
  claude: { personality: 'Wild card, experimental plays' },
  'gpt-4o': { personality: 'Wild card, experimental plays' },
  gemini: { personality: 'Wild card, experimental plays' },
  grok: { personality: 'Wild card, experimental plays' },
  deepseek: { personality: 'Wild card, experimental plays' },
  llama: { personality: 'Wild card, experimental plays' },
};

// Agent colors keyed by player ID (works for both OpenRouter and direct API modes)
const AGENT_COLORS: Record<string, string> = {
  claude: '#D4A574',
  'gpt-4o': '#74AA9C',
  gemini: '#4285F4',
  grok: '#FF6B35',
  deepseek: '#00BCD4',
  llama: '#9C27B0',
};

// OpenRouter model IDs for each agent
const OPENROUTER_MODELS: Record<string, string> = {
  claude: 'anthropic/claude-sonnet-4.5',
  'gpt-4o': 'openai/gpt-4o',
  gemini: 'google/gemini-2.5-flash',
  grok: 'x-ai/grok-4-fast',
  deepseek: 'deepseek/deepseek-chat-v3.1',
  llama: 'meta-llama/llama-3.3-70b-instruct',
};

const USE_OPENROUTER = !!process.env.OPENROUTER_API_KEY;

const AGENTS: AgentConfig[] = USE_OPENROUTER
  ? [
      { id: 'claude', name: 'Claude', provider: 'openrouter', model: OPENROUTER_MODELS.claude, seatIndex: 0, color: AGENT_COLORS.claude },
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openrouter', model: OPENROUTER_MODELS['gpt-4o'], seatIndex: 1, color: AGENT_COLORS['gpt-4o'] },
      { id: 'gemini', name: 'Gemini', provider: 'openrouter', model: OPENROUTER_MODELS.gemini, seatIndex: 2, color: AGENT_COLORS.gemini },
      { id: 'grok', name: 'Grok', provider: 'openrouter', model: OPENROUTER_MODELS.grok, seatIndex: 3, color: AGENT_COLORS.grok },
      { id: 'deepseek', name: 'DeepSeek', provider: 'openrouter', model: OPENROUTER_MODELS.deepseek, seatIndex: 4, color: AGENT_COLORS.deepseek },
      { id: 'llama', name: 'Llama', provider: 'openrouter', model: OPENROUTER_MODELS.llama, seatIndex: 5, color: AGENT_COLORS.llama },
    ]
  : [
      { id: 'claude', name: 'Claude', provider: 'anthropic', model: 'claude-sonnet-4-5-20250514', seatIndex: 0, color: AGENT_COLORS.claude },
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', model: 'gpt-4o', seatIndex: 1, color: AGENT_COLORS['gpt-4o'] },
      { id: 'gemini', name: 'Gemini', provider: 'google', model: 'gemini-2.5-flash', seatIndex: 2, color: AGENT_COLORS.gemini },
      { id: 'grok', name: 'Grok', provider: 'xai', model: 'grok-3', seatIndex: 3, color: AGENT_COLORS.grok },
    ];

// ---- Configuration ----

const PORT = parseInt(process.env.GAME_SERVER_PORT ?? '3001', 10);
const DEMO_TOKEN = process.env.DEMO_TOKEN ?? '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const MOCK_LLM = process.env.MOCK_LLM === 'true';
const DECK_SEED = process.env.DECK_SEED || undefined;

// ---- Server setup ----

const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', clients: wsManager?.getClientCount() ?? 0 }));
    return;
  }

  // Admin restart endpoint: POST /api/restart
  if (req.method === 'POST' && req.url === '/api/restart') {
    if (!ADMIN_TOKEN) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ADMIN_TOKEN not configured' }));
      return;
    }
    const auth = req.headers.authorization ?? '';
    if (auth !== `Bearer ${ADMIN_TOKEN}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    // Cancel any pending auto-restart
    if (autoRestartTimer) {
      clearTimeout(autoRestartTimer);
      autoRestartTimer = null;
    }
    // Stop current game and restart
    if (currentGame) {
      currentGame.stop();
    }
    isGameRunning = false;
    stateManager.reset();
    console.log('\n🔄 Admin triggered restart');
    setTimeout(() => startGame(), 2000);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'restarting' }));
    return;
  }

  res.writeHead(404);
  res.end();
});

const stateManager = new StateManager();
const wsManager = new WebSocketManager(server, stateManager, DEMO_TOKEN);

// ---- Action history tracking ----

let actionHistory: string[] = [];

function buildActionHistoryString(): string {
  return actionHistory.join(' → ');
}

/** Compute hand strength analysis for all active players */
function computeHandStrengths(gameState: GameState): Record<string, HandStrengthInfo> {
  const strengths: Record<string, HandStrengthInfo> = {};
  for (const player of gameState.players) {
    if (!player.isEliminated && !player.isFolded && player.holeCards.length === 2) {
      strengths[player.id] = analyzeHandStrength(player.holeCards, gameState.communityCards);
    }
  }
  return strengths;
}

/** Broadcast hand strengths to all spectators */
function broadcastHandStrengths(gameState: GameState): void {
  const strengths = computeHandStrengths(gameState);
  wsManager.broadcast({ event: 'handStrengths', data: strengths });
}

// ---- Game runner ----

let currentGame: Game | null = null;
let currentGamePromise: Promise<void> | null = null;
let isGameRunning = false;
let autoRestartTimer: ReturnType<typeof setTimeout> | null = null;
let buffSystem: BuffSystem | null = null;
let scoutingSystem: ScoutingSystem | null = null;
let strategyJournal: StrategyJournal | null = null;

// Track per-hand state for reactive buff triggers
let handChipSnapshots: Map<string, number> = new Map(); // chips at hand start
let handFoldedPreflop: Set<string> = new Set();          // who folded preflop

const mockAdapters = new Map<string, ReturnType<typeof createMockAdapter>>();

async function getPlayerAction(
  player: PlayerState,
  gameState: GameState,
  validActions: ValidActions,
): Promise<AgentAction> {
  if (MOCK_LLM) {
    // Use mock adapter
    let adapter = mockAdapters.get(player.id);
    if (!adapter) {
      adapter = createMockAdapter('random');
      mockAdapters.set(player.id, adapter);
    }
    const action = adapter(validActions);
    // Simulate latency
    await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
    return action;
  }

  const totalPot = gameState.pots.reduce((sum, p) => sum + p.amount, 0);
  const personality = AGENT_PERSONALITIES[player.id]?.personality ?? 'Balanced poker player';

  // Get buff prompt from the buff system
  const buffPrompt = buffSystem?.getBuffPrompt(player.id) ?? '';

  // Get scouting report for this player's opponents
  let scoutingPrompt = '';
  if (scoutingSystem) {
    const playerNames = new Map(gameState.players.map(p => [p.id, p.name]));
    const playerChips = new Map(gameState.players.filter(p => !p.isEliminated).map(p => [p.id, p.chips]));
    scoutingPrompt = scoutingSystem.getScoutingPrompt(player.id, playerNames, playerChips);
  }

  // Get strategy journal (self-awareness of own patterns)
  const strategyPrompt = strategyJournal?.getStrategyPrompt(player.id, player.chips) ?? '';

  const opponentChips = gameState.players
    .filter(p => p.id !== player.id && !p.isEliminated && !p.isFolded)
    .map(p => ({ name: p.name, chips: p.chips }));

  const promptContext: PromptContext = {
    name: player.name,
    personality,
    buffPrompt,
    scoutingPrompt,
    strategyPrompt,
    holeCards: player.holeCards,
    communityCards: gameState.communityCards,
    pot: totalPot,
    chips: player.chips,
    chipsInPot: player.currentBet,
    bigBlind: gameState.blinds.big,
    opponentChips,
    round: gameState.round,
    actionHistory: buildActionHistoryString(),
    validActions,
  };

  // When using OpenRouter, create a per-model config dynamically
  const providerConfig = player.provider === 'openrouter'
    ? createOpenRouterConfig(player.model)
    : undefined;

  const action = await llmGetAction({
    playerId: player.id,
    providerName: player.provider,
    promptContext,
    providerConfig,
  });

  // Mark player as bot if circuit breaker is open
  if (isCircuitOpen(player.id) && currentGame) {
    currentGame.markPlayerAsBot(player.id);
  }

  return action;
}

async function handleGameEvent(event: GameEvent): Promise<void> {
  switch (event.type) {
    case 'handStart': {
      actionHistory = [];
      handFoldedPreflop.clear();
      scoutingSystem?.startHand();
      strategyJournal?.startHand();

      // Roll buffs for each active player
      const players = currentGame!.getPlayers();
      handChipSnapshots.clear();
      for (const p of players) {
        if (!p.isEliminated) {
          handChipSnapshots.set(p.id, p.chips);
          if (buffSystem) {
            const buff = buffSystem.rollHandBuff(p.id);
            console.log(`  ${p.name}: ${buff.emoji} ${buff.name}`);
          }
        }
      }

      // Broadcast buff state alongside hand start
      const buffDisplays = buffSystem?.getAllBuffDisplays() ?? {};
      wsManager.broadcast({ event: 'handStart', data: { ...event, buffs: buffDisplays } });

      // Broadcast initial game state so frontend can render the table
      const initialState: GameState = {
        handNumber: event.handNumber,
        round: 'preflop',
        communityCards: [],
        pots: [],
        currentPlayerId: null,
        players,
        dealerIndex: event.dealerIndex,
        blinds: event.blinds,
        isGameOver: false,
      };
      stateManager.setGameState(initialState);
      wsManager.broadcast({ event: 'gameState', data: initialState });
      broadcastHandStrengths(initialState);
      console.log(`\n=== Hand #${event.handNumber} | Dealer: seat ${event.dealerIndex} ===`);
      break;
    }

    case 'action': {
      // Build action history string
      const actionStr = event.action.action === 'raise'
        ? `${event.player.name}: raise $${event.action.amount}`
        : `${event.player.name}: ${event.action.action}`;
      actionHistory.push(actionStr);

      // Add to reasoning buffer
      const thought: AgentThought = {
        playerId: event.player.id,
        playerName: event.player.name,
        color: event.player.color,
        reasoning: event.action.reasoning,
        action: event.action,
        handNumber: event.gameState.handNumber,
        round: event.gameState.round,
        timestamp: Date.now(),
      };
      stateManager.addThought(thought);
      stateManager.setGameState(event.gameState);

      // Apply pacing — ensure minimum display time per action
      try {
        await stateManager.waitForPacing(event.action.latencyMs, 'actionDisplay');
      } catch { /* pacing error should not halt the game */ }

      // Broadcast to spectators
      wsManager.broadcast({
        event: 'action',
        data: {
          player: event.player,
          reasoning: event.action.reasoning,
          action: event.action,
          latencyMs: event.action.latencyMs,
          gameState: event.gameState,
        },
      });
      broadcastHandStrengths(event.gameState);

      // Record action for scouting system
      if (scoutingSystem) {
        // Determine highest bet from game state to detect if player faced a raise
        const highestBet = Math.max(...event.gameState.players.map(p => p.currentBet));
        scoutingSystem.recordAction(
          event.player.id,
          event.action.action,
          event.gameState.round,
          event.player.currentBet,
          highestBet,
        );
      }

      // Record action for strategy journal (self-awareness)
      strategyJournal?.recordAction(
        event.player.id,
        event.action.action,
        event.gameState.round,
      );

      // Track preflop folds for reactive buffs
      if (event.action.action === 'fold' && event.gameState.round === 'preflop') {
        handFoldedPreflop.add(event.player.id);
      }

      console.log(`  ${actionStr} (${event.action.latencyMs}ms) — "${event.action.reasoning.slice(0, 60)}..."`);
      break;
    }

    case 'roundChange': {
      actionHistory = [];
      // Build and persist the updated game state with new community cards
      const roundState: GameState = {
        ...stateManager.getGameState()!,
        round: event.round,
        communityCards: [...event.communityCards],
      };
      stateManager.setGameState(roundState);
      try {
        await stateManager.waitForPacing(0, 'communityCardReveal');
      } catch { /* pacing error should not halt the game */ }
      wsManager.broadcast({ event: 'roundChange', data: { ...event, gameState: roundState } });
      broadcastHandStrengths(roundState);
      console.log(`  --- ${event.round.toUpperCase()} --- [${event.communityCards.map(c => `${c.rank}${c.suit[0]}`).join(' ')}]`);
      break;
    }

    case 'handEnd': {
      // Convert Map to object for JSON serialization
      const winnersObj: Record<string, number> = {};
      for (const [id, amount] of event.winners) {
        winnersObj[id] = amount;
      }
      const showdownObj: Record<string, any> = {};
      for (const [id, cards] of event.showdownHands) {
        showdownObj[id] = cards;
      }
      // Record hand results for scouting system
      if (scoutingSystem) {
        const showdownMap = new Map<string, any>();
        for (const [id, cards] of Object.entries(showdownObj)) {
          showdownMap.set(id, cards);
        }
        const winnersMap = new Map<string, number>();
        for (const [id, amount] of Object.entries(winnersObj)) {
          winnersMap.set(id, amount as number);
        }
        const activeIds = currentGame!.getPlayers().filter(p => !p.isEliminated).map(p => p.id);
        scoutingSystem.recordHandEnd(showdownMap, winnersMap, activeIds);
      }

      // Record hand results for buff system reactive triggers
      if (buffSystem) {
        const currentPlayers = currentGame!.getPlayers();
        for (const p of currentPlayers) {
          if (!p.isEliminated) {
            const chipsBefore = handChipSnapshots.get(p.id) ?? p.chips;
            const chipsNow = p.chips + (winnersObj[p.id] ?? 0); // chips after pot distribution
            buffSystem.recordHandResult(p.id, {
              won: (winnersObj[p.id] ?? 0) > 0,
              chipsDelta: chipsNow - chipsBefore,
              stackBefore: chipsBefore,
              foldedPreflop: handFoldedPreflop.has(p.id),
              wasBluffed: false, // TODO: detect bluffs from showdown data
            });
          }
        }
      }

      // Record hand results for strategy journal (self-awareness)
      if (strategyJournal) {
        const currentPlayersStrat = currentGame!.getPlayers();
        const currentHandNumber = stateManager.getGameState()?.handNumber ?? 0;
        for (const p of currentPlayersStrat) {
          if (!p.isEliminated) {
            const chipsBefore = handChipSnapshots.get(p.id) ?? p.chips;
            const chipsWon = winnersObj[p.id] ?? 0;
            const chipsNow = p.chips + chipsWon;
            strategyJournal.recordHandEnd(p.id, {
              handNumber: currentHandNumber,
              won: chipsWon > 0,
              chipsDelta: chipsNow - chipsBefore,
              currentChips: chipsNow,
              sawShowdown: event.showdownHands.has(p.id),
            });
          }
        }
      }

      // Generate trash talk reactions (winner only)
      const totalPot = event.pots.reduce((sum, p) => sum + p.amount, 0);
      const everyoneFolded = event.showdownHands.size <= 1;
      const currentPlayers2 = currentGame!.getPlayers();
      const reactionContexts: ReactionContext[] = currentPlayers2
        .filter(p => !p.isEliminated || (winnersObj[p.id] ?? 0) > 0)
        .map(p => ({
          playerId: p.id,
          playerName: p.name,
          isWinner: (winnersObj[p.id] ?? 0) > 0,
          chipsDelta: (winnersObj[p.id] ?? 0) > 0
            ? (winnersObj[p.id] ?? 0)
            : -((handChipSnapshots.get(p.id) ?? p.chips) - p.chips),
          potSize: totalPot,
          everyoneFolded,
          wasAllIn: p.isAllIn,
          chipsBefore: handChipSnapshots.get(p.id) ?? p.chips,
          isEliminated: p.isEliminated,
          isFolded: p.isFolded,
        }));

      // Static fallback reactions (winner only)
      const staticReactions = generateReactions(reactionContexts);

      // Attempt LLM-generated trash talk for each winner
      const gameStateNow = stateManager.getGameState();
      const communityCardsStr = gameStateNow?.communityCards
        .map(c => `${c.rank}${({ hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' } as Record<string, string>)[c.suit]}`)
        .join(' ') ?? 'None';

      const winnerContexts = reactionContexts.filter(c => c.isWinner);
      let reactions: Reaction[];

      if (!MOCK_LLM && winnerContexts.length > 0) {
        // Build narratives and call LLM in parallel for all winners
        const trashTalkPromises = winnerContexts.map(async (wCtx) => {
          const player = currentPlayers2.find(p => p.id === wCtx.playerId);
          if (!player) return null;

          const holeCardsStr = (showdownObj[wCtx.playerId] ?? player.holeCards)
            .map((c: any) => `${c.rank}${({ hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' } as Record<string, string>)[c.suit]}`)
            .join(' ');

          const narrative = buildHandNarrative(wCtx, reactionContexts, holeCardsStr, communityCardsStr, buildActionHistoryString());

          const trashTalkCtx: TrashTalkContext = {
            ...narrative,
            buffPrompt: buffSystem?.getBuffPrompt(wCtx.playerId),
          };

          const providerConfig = player.provider === 'openrouter'
            ? createOpenRouterConfig(player.model)
            : undefined;

          const line = await getTrashTalk({
            playerId: player.id,
            providerName: player.provider,
            trashTalkContext: trashTalkCtx,
            providerConfig,
          });

          if (line) {
            return {
              playerId: wCtx.playerId,
              message: line,
              tone: 'gloat' as const,
              isLlmGenerated: true,
            };
          }
          return null;
        });

        const llmResults = await Promise.all(trashTalkPromises);
        const llmReactions: Reaction[] = llmResults.filter(r => r !== null) as Reaction[];

        // Use LLM reactions for winners that got a response, static fallback for others
        const llmWinnerIds = new Set(llmReactions.map(r => r.playerId));
        const fallbacks = staticReactions.filter(r => !llmWinnerIds.has(r.playerId));
        reactions = [...llmReactions, ...fallbacks];

        for (const r of llmReactions) {
          const name = currentPlayers2.find(p => p.id === r.playerId)?.name ?? r.playerId;
          console.log(`  💬 ${name}: "${r.message}"`);
        }
      } else {
        reactions = staticReactions;
      }

      // Apply showdown pacing
      try {
        await stateManager.waitForPacing(0, 'showdown');
      } catch { /* pacing error should not halt the game */ }
      wsManager.broadcast({
        event: 'handEnd',
        data: {
          winners: winnersObj,
          potDistribution: event.pots,
          showdownHands: showdownObj,
          reactions,
        },
      });
      console.log(`  Winners: ${Object.entries(winnersObj).map(([id, amt]) => `${id}: $${amt}`).join(', ')}`);
      break;
    }

    case 'gameOver':
      wsManager.broadcast({ event: 'gameOver', data: event });
      isGameRunning = false;
      stateManager.reset();
      console.log(`\n🏆 Game Over! Winner: ${event.winner.name} ($${event.winner.chips})`);
      console.log('  Auto-restarting in 10 seconds...');
      if (autoRestartTimer) clearTimeout(autoRestartTimer);
      autoRestartTimer = setTimeout(() => {
        autoRestartTimer = null;
        if (!isGameRunning) {
          console.log('\n🔄 Auto-restarting game...');
          startGame();
        }
      }, 10_000);
      break;
  }
}

async function startGame(): Promise<void> {
  if (isGameRunning) {
    console.log('Game already running');
    return;
  }

  // Wait for previous game to fully stop before starting new one
  if (currentGamePromise) {
    console.log('  Waiting for previous game to finish...');
    await currentGamePromise.catch(() => {});
    currentGamePromise = null;
  }

  isGameRunning = true;
  stateManager.reset();
  mockAdapters.clear();
  resetAllFailures();
  handChipSnapshots.clear();
  handFoldedPreflop.clear();

  // Initialize buff system with session traits for each player
  buffSystem = new BuffSystem(DECK_SEED);
  for (const agent of AGENTS) {
    const state = buffSystem.initPlayer(agent.id);
    console.log(`  ${agent.name} session traits: ${state.sessionTraits.map(t => `${t.emoji} ${t.name}`).join(', ')}`);
  }

  // Initialize scouting system for opponent learning
  scoutingSystem = new ScoutingSystem();
  const allPlayerIds = AGENTS.map(a => a.id);
  for (const agent of AGENTS) {
    scoutingSystem.initPlayer(agent.id, allPlayerIds);
  }

  // Initialize strategy journal for self-awareness
  strategyJournal = new StrategyJournal();
  for (const agent of AGENTS) {
    strategyJournal.initPlayer(agent.id, 10000); // startingChips
  }

  console.log(`Starting game with ${AGENTS.length} agents (mock=${MOCK_LLM})`);

  const game = new Game(
    AGENTS,
    getPlayerAction,
    handleGameEvent,
    {
      startingChips: 10000,
      blinds: { small: 50, big: 100 },
      maxHands: 0,
      seed: DECK_SEED,
    },
  );

  currentGame = game;

  const gamePromise = game.run();
  currentGamePromise = gamePromise;

  try {
    await gamePromise;
  } catch (err) {
    console.error('Game error:', err);
    isGameRunning = false;
    stateManager.reset();
    console.log('  Auto-restarting after error in 10 seconds...');
    if (autoRestartTimer) clearTimeout(autoRestartTimer);
    autoRestartTimer = setTimeout(() => {
      autoRestartTimer = null;
      if (!isGameRunning) {
        console.log('\n🔄 Auto-restarting game after error...');
        startGame();
      }
    }, 10_000);
  }
}

// ---- Wire up startGame from WebSocket ----

wsManager.onStartGame = () => {
  if (!isGameRunning) {
    startGame();
  }
};

// ---- Start server ----

wsManager.startHeartbeat();

server.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
  console.log(`Mock LLM: ${MOCK_LLM}`);
  console.log(`Provider: ${USE_OPENROUTER ? 'OpenRouter (all 6 models)' : 'Direct API keys'}`);
  console.log(`Agents: ${AGENTS.map(a => a.name).join(', ')}`);
  console.log(`Demo token: ${DEMO_TOKEN ? 'set' : 'not set (open access)'}`);

  // Auto-start game when ready
  if (MOCK_LLM) {
    console.log('Auto-starting game in mock mode...');
    startGame();
  } else if (USE_OPENROUTER) {
    console.log('Auto-starting game with OpenRouter...');
    startGame();
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  currentGame?.stop();
  wsManager.close();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  currentGame?.stop();
  wsManager.close();
  server.close();
  process.exit(0);
});
