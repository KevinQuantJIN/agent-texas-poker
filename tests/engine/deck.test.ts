import { describe, it, expect } from 'vitest';
import { createDeck, shuffle, deal, seededRng, createShuffledDeck, formatCard } from '@/engine/deck';

describe('createDeck', () => {
  it('creates a 52-card deck', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
  });

  it('has no duplicates', () => {
    const deck = createDeck();
    const keys = deck.map(c => `${c.rank}-${c.suit}`);
    expect(new Set(keys).size).toBe(52);
  });

  it('has 4 of each rank', () => {
    const deck = createDeck();
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    for (const rank of ranks) {
      expect(deck.filter(c => c.rank === rank)).toHaveLength(4);
    }
  });

  it('has 13 of each suit', () => {
    const deck = createDeck();
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
    for (const suit of suits) {
      expect(deck.filter(c => c.suit === suit)).toHaveLength(13);
    }
  });
});

describe('shuffle', () => {
  it('returns all 52 cards', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    expect(shuffled).toHaveLength(52);
    const keys = shuffled.map(c => `${c.rank}-${c.suit}`);
    expect(new Set(keys).size).toBe(52);
  });

  it('does not mutate the original deck', () => {
    const deck = createDeck();
    const original = [...deck];
    shuffle(deck);
    expect(deck).toEqual(original);
  });

  it('produces different order than original (with high probability)', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    // Extremely unlikely to be identical
    const samePositions = deck.filter((c, i) =>
      c.rank === shuffled[i].rank && c.suit === shuffled[i].suit
    ).length;
    expect(samePositions).toBeLessThan(52);
  });
});

describe('seededRng', () => {
  it('produces deterministic results for same seed', () => {
    const rng1 = seededRng('test-seed');
    const rng2 = seededRng('test-seed');
    const values1 = Array.from({ length: 10 }, () => rng1());
    const values2 = Array.from({ length: 10 }, () => rng2());
    expect(values1).toEqual(values2);
  });

  it('produces different results for different seeds', () => {
    const rng1 = seededRng('seed-a');
    const rng2 = seededRng('seed-b');
    const values1 = Array.from({ length: 10 }, () => rng1());
    const values2 = Array.from({ length: 10 }, () => rng2());
    expect(values1).not.toEqual(values2);
  });

  it('produces values between 0 and 1', () => {
    const rng = seededRng('bounds-test');
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('createShuffledDeck', () => {
  it('is deterministic with a seed', () => {
    const d1 = createShuffledDeck('test');
    const d2 = createShuffledDeck('test');
    expect(d1).toEqual(d2);
  });

  it('varies without a seed', () => {
    const d1 = createShuffledDeck();
    const d2 = createShuffledDeck();
    // Very unlikely to be the same
    const same = d1.every((c, i) => c.rank === d2[i].rank && c.suit === d2[i].suit);
    expect(same).toBe(false);
  });
});

describe('deal', () => {
  it('deals the requested number of cards', () => {
    const deck = createDeck();
    const cards = deal(deck, 5);
    expect(cards).toHaveLength(5);
    expect(deck).toHaveLength(47);
  });

  it('deals from the top of the deck', () => {
    const deck = createDeck();
    const first = deck[0];
    const cards = deal(deck, 1);
    expect(cards[0]).toEqual(first);
  });

  it('throws when not enough cards', () => {
    const deck = createDeck();
    expect(() => deal(deck, 53)).toThrow('Cannot deal 53 cards');
  });
});

describe('formatCard', () => {
  it('formats cards correctly', () => {
    expect(formatCard({ rank: 'A', suit: 'hearts' })).toBe('Ah');
    expect(formatCard({ rank: '10', suit: 'clubs' })).toBe('10c');
    expect(formatCard({ rank: 'K', suit: 'spades' })).toBe('Ks');
    expect(formatCard({ rank: '2', suit: 'diamonds' })).toBe('2d');
  });
});
