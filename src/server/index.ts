import 'dotenv/config';
import http from 'http';
import { Game, AgentConfig, GameEvent } from '../engine/game';
import { getAction as llmGetAction, resetAllFailures } from '../adapters/llm-adapter';
import { createMockAdapter } from '../adapters/mock-adapter';
import { createOpenRouterConfig } from '../adapters/providers';
import { buildUserPrompt, buildSystemPrompt, PromptContext } from '../adapters/prompt';
import { getValidActions } from '../engine/betting';
import { WebSocketManager } from './websocket';
import { StateManager } from './state-manager';
import type { AgentAction, AgentThought, GameState, PlayerState, ValidActions, InternalPlayer } from '../engine/types';

// ---- Agent definitions ----

const AGENT_PERSONALITIES: Record<string, { personality: string }> = {
  claude: { personality: 'Analytical, cautious, reads opponents carefully' },
  'gpt-4o': { personality: 'Aggressive, calculated risk-taker' },
  gemini: { personality: 'Balanced, adaptive strategist' },
  grok: { personality: 'Loose cannon, unpredictable, trash-talks in reasoning' },
  deepseek: { personality: 'Tight, mathematical, probability-focused' },
  llama: { personality: 'Wild card, experimental plays' },
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
      { id: 'claude', name: 'Claude', provider: 'openrouter', model: OPENROUTER_MODELS.claude, seatIndex: 0 },
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openrouter', model: OPENROUTER_MODELS['gpt-4o'], seatIndex: 1 },
      { id: 'gemini', name: 'Gemini', provider: 'openrouter', model: OPENROUTER_MODELS.gemini, seatIndex: 2 },
      { id: 'grok', name: 'Grok', provider: 'openrouter', model: OPENROUTER_MODELS.grok, seatIndex: 3 },
      { id: 'deepseek', name: 'DeepSeek', provider: 'openrouter', model: OPENROUTER_MODELS.deepseek, seatIndex: 4 },
      { id: 'llama', name: 'Llama', provider: 'openrouter', model: OPENROUTER_MODELS.llama, seatIndex: 5 },
    ]
  : [
      { id: 'claude', name: 'Claude', provider: 'anthropic', model: 'claude-sonnet-4-5-20250514', seatIndex: 0 },
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', model: 'gpt-4o', seatIndex: 1 },
      { id: 'gemini', name: 'Gemini', provider: 'google', model: 'gemini-2.5-flash', seatIndex: 2 },
      { id: 'grok', name: 'Grok', provider: 'xai', model: 'grok-3', seatIndex: 3 },
    ];

// ---- Configuration ----

const PORT = parseInt(process.env.GAME_SERVER_PORT ?? '3001', 10);
const DEMO_TOKEN = process.env.DEMO_TOKEN ?? '';
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

// ---- Game runner ----

let currentGame: Game | null = null;
let isGameRunning = false;

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

  const promptContext: PromptContext = {
    name: player.name,
    personality,
    holeCards: player.holeCards,
    communityCards: gameState.communityCards,
    pot: totalPot,
    chips: player.chips,
    round: gameState.round,
    actionHistory: buildActionHistoryString(),
    validActions,
  };

  // When using OpenRouter, create a per-model config dynamically
  const providerConfig = player.provider === 'openrouter'
    ? createOpenRouterConfig(player.model)
    : undefined;

  return llmGetAction({
    playerId: player.id,
    providerName: player.provider,
    promptContext,
    providerConfig,
  });
}

function handleGameEvent(event: GameEvent): void {
  switch (event.type) {
    case 'handStart': {
      actionHistory = [];
      wsManager.broadcast({ event: 'handStart', data: event });
      // Broadcast initial game state so frontend can render the table
      const initialState: GameState = {
        handNumber: event.handNumber,
        round: 'preflop',
        communityCards: [],
        pots: [],
        currentPlayerId: null,
        players: currentGame!.getPlayers(),
        dealerIndex: event.dealerIndex,
        blinds: event.blinds,
        isGameOver: false,
      };
      stateManager.setGameState(initialState);
      wsManager.broadcast({ event: 'gameState', data: initialState });
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
        reasoning: event.action.reasoning,
        action: event.action,
        handNumber: event.gameState.handNumber,
        round: event.gameState.round,
        timestamp: Date.now(),
      };
      stateManager.addThought(thought);
      stateManager.setGameState(event.gameState);

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

      console.log(`  ${actionStr} (${event.action.latencyMs}ms) — "${event.action.reasoning.slice(0, 60)}..."`);
      break;
    }

    case 'roundChange':
      wsManager.broadcast({ event: 'roundChange', data: event });
      console.log(`  --- ${event.round.toUpperCase()} --- [${event.communityCards.map(c => `${c.rank}${c.suit[0]}`).join(' ')}]`);
      break;

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
      wsManager.broadcast({
        event: 'handEnd',
        data: {
          winners: winnersObj,
          potDistribution: event.pots,
          showdownHands: showdownObj,
        },
      });
      console.log(`  Winners: ${Object.entries(winnersObj).map(([id, amt]) => `${id}: $${amt}`).join(', ')}`);
      break;
    }

    case 'gameOver':
      wsManager.broadcast({ event: 'gameOver', data: event });
      isGameRunning = false;
      console.log(`\n🏆 Game Over! Winner: ${event.winner.name} ($${event.winner.chips})`);
      break;
  }
}

async function startGame(): Promise<void> {
  if (isGameRunning) {
    console.log('Game already running');
    return;
  }

  isGameRunning = true;
  stateManager.reset();
  mockAdapters.clear();
  resetAllFailures();

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

  try {
    await game.run();
  } catch (err) {
    console.error('Game error:', err);
    isGameRunning = false;
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
