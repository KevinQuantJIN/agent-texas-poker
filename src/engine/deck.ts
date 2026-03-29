import { Card, Rank, Suit } from './types';

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

/** Create a fresh 52-card deck in order. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/**
 * Seeded PRNG (xorshift32). Deterministic for testing.
 * Accepts a string seed, hashes it to a 32-bit integer.
 */
export function seededRng(seed: string): () => number {
  let state = hashString(seed);
  if (state === 0) state = 1; // xorshift can't have 0 state
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xFFFFFFFF;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash;
}

/** Fisher-Yates shuffle. Uses Math.random by default, or a seeded RNG. */
export function shuffle(deck: Card[], rng: () => number = Math.random): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Deal n cards from the top of the deck (mutates the deck array). */
export function deal(deck: Card[], n: number): Card[] {
  if (deck.length < n) {
    throw new Error(`Cannot deal ${n} cards from deck with ${deck.length} cards`);
  }
  return deck.splice(0, n);
}

/** Create a shuffled deck, optionally seeded. */
export function createShuffledDeck(seed?: string): Card[] {
  const deck = createDeck();
  const rng = seed ? seededRng(seed) : Math.random;
  return shuffle(deck, rng);
}

/** Format a card for display: "Ah", "10c", "Ks", etc. */
export function formatCard(card: Card): string {
  const suitChar = { hearts: 'h', diamonds: 'd', clubs: 'c', spades: 's' }[card.suit];
  return `${card.rank}${suitChar}`;
}
