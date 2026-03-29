// ============================================================
// Shared engine types — Card, Hand, Game, Player, etc.
// ============================================================

export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type BettingRound = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface PlayerState {
  id: string;
  name: string;
  provider: string;
  model: string;
  chips: number;
  holeCards: Card[];
  currentBet: number;
  isFolded: boolean;
  isAllIn: boolean;
  isEliminated: boolean;
  isBotFallback: boolean;
  seatIndex: number;
  lastAction: AgentAction | null;
  color: string;
}

export interface AgentAction {
  action: 'fold' | 'check' | 'call' | 'raise';
  amount?: number;
  reasoning: string;
  latencyMs: number;
}

export interface AgentThought {
  playerId: string;
  playerName: string;
  reasoning: string;
  action: AgentAction;
  handNumber: number;
  round: string;
  timestamp: number;
}

export interface GameState {
  handNumber: number;
  round: BettingRound;
  communityCards: Card[];
  pots: Pot[];
  currentPlayerId: string | null;
  players: PlayerState[];
  dealerIndex: number;
  blinds: { small: number; big: number };
  isGameOver: boolean;
}

export interface GameConfig {
  startingChips: number;
  blinds: { small: number; big: number };
  maxHands: number; // 0 = unlimited
  seed?: string;    // for deterministic shuffle
}

export const DEFAULT_CONFIG: GameConfig = {
  startingChips: 10000,
  blinds: { small: 50, big: 100 },
  maxHands: 0,
};

// Valid actions a player can take
export interface ValidActions {
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  minRaise: number;
  maxRaise: number; // all-in amount
}

// Internal hand state used during a hand (not sent to frontend)
export interface HandState {
  deck: Card[];
  communityCards: Card[];
  players: InternalPlayer[];
  pots: Pot[];
  dealerIndex: number;
  round: BettingRound;
  currentPlayerIndex: number;
  lastRaiseAmount: number;    // size of the last raise (for min-raise calc)
  highestBet: number;         // highest bet in current round
  actionCount: number;        // actions taken in current betting round
  playersActedThisRound: Set<string>; // track who has acted
}

export interface InternalPlayer extends PlayerState {
  totalBetThisHand: number; // total chips put in across all rounds (for side pots)
}
