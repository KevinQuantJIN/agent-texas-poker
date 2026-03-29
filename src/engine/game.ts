import { createShuffledDeck, deal } from './deck';
import { calculatePots, distributePot } from './pot';
import { getValidActions, validateAction, applyAction } from './betting';
import { determineWinners } from './hand-eval';
import {
  AgentAction,
  BettingRound,
  Card,
  DEFAULT_CONFIG,
  GameConfig,
  GameState,
  HandState,
  InternalPlayer,
  PlayerState,
  Pot,
  ValidActions,
} from './types';

// Agent personality colors
const AGENT_COLORS: Record<string, string> = {
  anthropic: '#D4A574',
  openai: '#74AA9C',
  google: '#4285F4',
  xai: '#FF6B35',
  deepseek: '#00BCD4',
  groq: '#9C27B0',
};

export interface AgentConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  seatIndex: number;
}

export type GetActionFn = (
  player: PlayerState,
  gameState: GameState,
  validActions: ValidActions,
) => Promise<AgentAction>;

export type OnEventFn = (event: GameEvent) => void;

export type GameEvent =
  | { type: 'handStart'; handNumber: number; dealerIndex: number; blinds: { small: number; big: number } }
  | { type: 'action'; player: PlayerState; action: AgentAction; gameState: GameState }
  | { type: 'roundChange'; round: BettingRound; communityCards: Card[] }
  | { type: 'handEnd'; winners: Map<string, number>; pots: Pot[]; showdownHands: Map<string, Card[]> }
  | { type: 'gameOver'; winner: PlayerState; finalStandings: PlayerState[] };

/**
 * Game manages a full poker session (multiple hands).
 */
export class Game {
  private config: GameConfig;
  private players: InternalPlayer[];
  private dealerIndex: number;
  private handNumber: number;
  private getAction: GetActionFn;
  private onEvent: OnEventFn;
  private isRunning: boolean = false;

  constructor(
    agents: AgentConfig[],
    getAction: GetActionFn,
    onEvent: OnEventFn,
    config: Partial<GameConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.getAction = getAction;
    this.onEvent = onEvent;
    this.handNumber = 0;
    this.dealerIndex = 0;

    this.players = agents.map((a) => ({
      id: a.id,
      name: a.name,
      provider: a.provider,
      model: a.model,
      chips: this.config.startingChips,
      holeCards: [],
      currentBet: 0,
      isFolded: false,
      isAllIn: false,
      isEliminated: false,
      isBotFallback: false,
      seatIndex: a.seatIndex,
      lastAction: null,
      color: AGENT_COLORS[a.provider] ?? '#888888',
      totalBetThisHand: 0,
    }));
  }

  /** Run the full game loop until completion. */
  async run(): Promise<void> {
    this.isRunning = true;

    while (this.isRunning) {
      const activePlayers = this.players.filter(p => !p.isEliminated);
      if (activePlayers.length <= 1) {
        this.endGame();
        break;
      }

      if (this.config.maxHands > 0 && this.handNumber >= this.config.maxHands) {
        this.endGame();
        break;
      }

      await this.playHand();
      this.advanceDealer();
    }
  }

  stop(): void {
    this.isRunning = false;
  }

  getPlayers(): PlayerState[] {
    return this.players.map(p => toPlayerState(p));
  }

  /** Play a single hand from deal to showdown. */
  async playHand(): Promise<void> {
    this.handNumber++;
    const seed = this.config.seed
      ? `${this.config.seed}-hand-${this.handNumber}`
      : undefined;

    // Reset per-hand state
    for (const p of this.players) {
      p.holeCards = [];
      p.currentBet = 0;
      p.isFolded = false;
      p.isAllIn = false;
      p.lastAction = null;
      p.totalBetThisHand = 0;
      if (p.chips <= 0) p.isEliminated = true;
    }

    const activePlayers = this.players.filter(p => !p.isEliminated);
    if (activePlayers.length <= 1) return;

    const deck = createShuffledDeck(seed);

    // Deal hole cards
    for (const p of activePlayers) {
      p.holeCards = deal(deck, 2);
    }

    const hand: HandState = {
      deck,
      communityCards: [],
      players: this.players,
      pots: [],
      dealerIndex: this.dealerIndex,
      round: 'preflop',
      currentPlayerIndex: 0,
      lastRaiseAmount: this.config.blinds.big,
      highestBet: 0,
      actionCount: 0,
      playersActedThisRound: new Set(),
    };

    this.onEvent({
      type: 'handStart',
      handNumber: this.handNumber,
      dealerIndex: this.dealerIndex,
      blinds: this.config.blinds,
    });

    // Post blinds
    this.postBlinds(hand, activePlayers);

    // Preflop betting
    await this.bettingRound(hand, 'preflop');
    if (this.isHandOver(hand)) {
      this.resolveHand(hand);
      return;
    }

    // Flop
    deal(hand.deck, 1); // burn
    hand.communityCards.push(...deal(hand.deck, 3));
    this.onEvent({ type: 'roundChange', round: 'flop', communityCards: [...hand.communityCards] });
    await this.bettingRound(hand, 'flop');
    if (this.isHandOver(hand)) {
      this.resolveHand(hand);
      return;
    }

    // Turn
    deal(hand.deck, 1); // burn
    hand.communityCards.push(...deal(hand.deck, 1));
    this.onEvent({ type: 'roundChange', round: 'turn', communityCards: [...hand.communityCards] });
    await this.bettingRound(hand, 'turn');
    if (this.isHandOver(hand)) {
      this.resolveHand(hand);
      return;
    }

    // River
    deal(hand.deck, 1); // burn
    hand.communityCards.push(...deal(hand.deck, 1));
    this.onEvent({ type: 'roundChange', round: 'river', communityCards: [...hand.communityCards] });
    await this.bettingRound(hand, 'river');

    // Showdown
    this.resolveHand(hand);
  }

  private postBlinds(hand: HandState, activePlayers: InternalPlayer[]): void {
    const isHeadsUp = activePlayers.length === 2;

    let sbIndex: number;
    let bbIndex: number;

    if (isHeadsUp) {
      // Heads-up: dealer posts SB, other posts BB
      sbIndex = this.findActivePlayerIndex(this.dealerIndex);
      bbIndex = this.findNextActivePlayer(sbIndex);
    } else {
      // Standard: SB left of dealer, BB left of SB
      sbIndex = this.findNextActivePlayer(this.dealerIndex);
      bbIndex = this.findNextActivePlayer(sbIndex);
    }

    // Post small blind
    const sbPlayer = this.players[sbIndex];
    const sbAmount = Math.min(this.config.blinds.small, sbPlayer.chips);
    sbPlayer.chips -= sbAmount;
    sbPlayer.currentBet = sbAmount;
    sbPlayer.totalBetThisHand = sbAmount;
    if (sbPlayer.chips === 0) sbPlayer.isAllIn = true;

    // Post big blind
    const bbPlayer = this.players[bbIndex];
    const bbAmount = Math.min(this.config.blinds.big, bbPlayer.chips);
    bbPlayer.chips -= bbAmount;
    bbPlayer.currentBet = bbAmount;
    bbPlayer.totalBetThisHand = bbAmount;
    if (bbPlayer.chips === 0) bbPlayer.isAllIn = true;

    hand.highestBet = bbAmount;
    hand.lastRaiseAmount = this.config.blinds.big;
  }

  private async bettingRound(hand: HandState, round: BettingRound): Promise<void> {
    hand.round = round;
    hand.playersActedThisRound = new Set();
    hand.actionCount = 0;

    // Reset current bets for post-flop rounds
    if (round !== 'preflop') {
      for (const p of hand.players) {
        p.currentBet = 0;
      }
      hand.highestBet = 0;
      hand.lastRaiseAmount = this.config.blinds.big;
    }

    // Determine first player to act
    const activePlayers = this.players.filter(p => !p.isEliminated);
    let startIndex: number;

    if (round === 'preflop') {
      // Preflop: action starts left of BB
      const isHeadsUp = activePlayers.length === 2;
      const sbIndex = isHeadsUp
        ? this.findActivePlayerIndex(this.dealerIndex)
        : this.findNextActivePlayer(this.dealerIndex);
      const bbIndex = this.findNextActivePlayer(sbIndex);
      startIndex = this.findNextActivePlayer(bbIndex);
    } else {
      // Post-flop: action starts left of dealer
      startIndex = this.findNextActivePlayer(this.dealerIndex);
    }

    let currentIndex = startIndex;

    while (true) {
      // If only one player is left (everyone else folded), stop immediately
      if (this.isHandOver(hand)) break;

      const player = this.players[currentIndex];

      // Skip folded, all-in, or eliminated players
      if (player.isFolded || player.isAllIn || player.isEliminated) {
        currentIndex = this.findNextActivePlayer(currentIndex);
        if (this.isBettingComplete(hand)) break;
        continue;
      }

      // Check if betting is complete
      if (this.isBettingComplete(hand)) break;

      const validActions = getValidActions(
        player,
        hand.highestBet,
        hand.lastRaiseAmount,
        this.config.blinds.big
      );

      const gameState = this.buildGameState(hand);
      const rawAction = await this.getAction(toPlayerState(player), gameState, validActions);
      const action = validateAction(rawAction, player, validActions);

      // Track raise amount before applying
      const previousBet = player.currentBet;
      applyAction(action, player);

      if (action.action === 'raise') {
        const raiseSize = player.currentBet - hand.highestBet;
        if (raiseSize > 0) {
          hand.lastRaiseAmount = raiseSize;
        }
        hand.highestBet = player.currentBet;
        // Reset acted tracking — everyone needs to act again after a raise
        hand.playersActedThisRound = new Set();
      }

      if (player.currentBet > hand.highestBet) {
        hand.highestBet = player.currentBet;
      }

      hand.playersActedThisRound.add(player.id);
      hand.actionCount++;
      player.lastAction = action;

      this.onEvent({
        type: 'action',
        player: toPlayerState(player),
        action,
        gameState: this.buildGameState(hand),
      });

      currentIndex = this.findNextActivePlayer(currentIndex);
    }
  }

  private isBettingComplete(hand: HandState): boolean {
    const canAct = this.players.filter(
      p => !p.isEliminated && !p.isFolded && !p.isAllIn
    );

    // Only one player left who can act (or zero)
    if (canAct.length <= 1) {
      // If the remaining player has matched the highest bet, done
      if (canAct.length === 0) return true;
      if (canAct[0].currentBet >= hand.highestBet && hand.playersActedThisRound.has(canAct[0].id)) {
        return true;
      }
    }

    // Everyone who can act has acted and matched
    const allMatched = canAct.every(
      p => hand.playersActedThisRound.has(p.id) && p.currentBet >= hand.highestBet
    );

    return allMatched;
  }

  private isHandOver(hand: HandState): boolean {
    const notFolded = this.players.filter(p => !p.isEliminated && !p.isFolded);
    return notFolded.length <= 1;
  }

  private resolveHand(hand: HandState): void {
    const pots = calculatePots(hand.players);
    const notFolded = this.players.filter(p => !p.isEliminated && !p.isFolded);
    const totalWinnings = new Map<string, number>();
    const showdownHands = new Map<string, Card[]>();

    if (notFolded.length === 1) {
      // Everyone folded to one player — they win everything
      const winner = notFolded[0];
      const totalPot = pots.reduce((sum, p) => sum + p.amount, 0);
      winner.chips += totalPot;
      totalWinnings.set(winner.id, totalPot);
    } else {
      // Showdown — evaluate hands for each pot
      const playerHoleCards = this.players.map(p => p.holeCards);
      const playerIndices = new Map(this.players.map((p, i) => [p.id, i]));

      for (const p of notFolded) {
        showdownHands.set(p.id, p.holeCards);
      }

      for (const pot of pots) {
        const eligibleIndices = pot.eligiblePlayerIds
          .map(id => playerIndices.get(id)!)
          .filter(i => !this.players[i].isFolded);

        if (eligibleIndices.length === 0) continue;

        const winnerIndices = determineWinners(
          playerHoleCards,
          hand.communityCards,
          eligibleIndices
        );

        const winnerIds = winnerIndices.map(i => this.players[i].id);
        const distribution = distributePot(pot, winnerIds);

        for (const [id, amount] of distribution) {
          const player = this.players.find(p => p.id === id)!;
          player.chips += amount;
          totalWinnings.set(id, (totalWinnings.get(id) ?? 0) + amount);
        }
      }
    }

    this.onEvent({
      type: 'handEnd',
      winners: totalWinnings,
      pots,
      showdownHands,
    });
  }

  private endGame(): void {
    this.isRunning = false;
    const sorted = [...this.players].sort((a, b) => b.chips - a.chips);
    const winner = sorted[0];

    this.onEvent({
      type: 'gameOver',
      winner: toPlayerState(winner),
      finalStandings: sorted.map(toPlayerState),
    });
  }

  private advanceDealer(): void {
    this.dealerIndex = this.findNextActivePlayer(this.dealerIndex);
  }

  private findNextActivePlayer(fromIndex: number): number {
    const n = this.players.length;
    let index = (fromIndex + 1) % n;
    let iterations = 0;
    while (this.players[index].isEliminated && iterations < n) {
      index = (index + 1) % n;
      iterations++;
    }
    return index;
  }

  private findActivePlayerIndex(targetIndex: number): number {
    // If the target is active, return it. Otherwise find next active.
    if (!this.players[targetIndex].isEliminated) return targetIndex;
    return this.findNextActivePlayer(targetIndex);
  }

  private buildGameState(hand: HandState): GameState {
    return {
      handNumber: this.handNumber,
      round: hand.round,
      communityCards: [...hand.communityCards],
      pots: calculatePots(hand.players),
      currentPlayerId: null,
      players: hand.players.map(toPlayerState),
      dealerIndex: hand.dealerIndex,
      blinds: this.config.blinds,
      isGameOver: false,
    };
  }
}

function toPlayerState(p: InternalPlayer): PlayerState {
  return {
    id: p.id,
    name: p.name,
    provider: p.provider,
    model: p.model,
    chips: p.chips,
    holeCards: [...p.holeCards],
    currentBet: p.currentBet,
    isFolded: p.isFolded,
    isAllIn: p.isAllIn,
    isEliminated: p.isEliminated,
    isBotFallback: p.isBotFallback,
    seatIndex: p.seatIndex,
    lastAction: p.lastAction,
    color: p.color,
  };
}
