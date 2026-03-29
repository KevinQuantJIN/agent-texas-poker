import { describe, it, expect } from 'vitest';
import { calculatePots, distributePot } from '@/engine/pot';
import { InternalPlayer } from '@/engine/types';

function makePlayer(overrides: Partial<InternalPlayer> & { id: string }): InternalPlayer {
  return {
    name: overrides.id,
    provider: 'test',
    model: 'test',
    chips: 10000,
    holeCards: [],
    currentBet: 0,
    isFolded: false,
    isAllIn: false,
    isEliminated: false,
    isBotFallback: false,
    seatIndex: 0,
    lastAction: null,
    color: '#fff',
    totalBetThisHand: 0,
    ...overrides,
  };
}

describe('calculatePots', () => {
  it('creates a single pot when no one is all-in', () => {
    const players = [
      makePlayer({ id: 'a', totalBetThisHand: 200 }),
      makePlayer({ id: 'b', totalBetThisHand: 200 }),
      makePlayer({ id: 'c', totalBetThisHand: 200 }),
    ];
    const pots = calculatePots(players);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(600);
    expect(pots[0].eligiblePlayerIds).toEqual(['a', 'b', 'c']);
  });

  it('excludes folded players from eligibility', () => {
    const players = [
      makePlayer({ id: 'a', totalBetThisHand: 200 }),
      makePlayer({ id: 'b', totalBetThisHand: 200, isFolded: true }),
      makePlayer({ id: 'c', totalBetThisHand: 200 }),
    ];
    const pots = calculatePots(players);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(600); // folded player's bet is still in the pot
    expect(pots[0].eligiblePlayerIds).toEqual(['a', 'c']); // but not eligible
  });

  it('creates side pots for a single all-in', () => {
    const players = [
      makePlayer({ id: 'a', totalBetThisHand: 500, isAllIn: true, chips: 0 }),
      makePlayer({ id: 'b', totalBetThisHand: 1200 }),
      makePlayer({ id: 'c', totalBetThisHand: 1200 }),
    ];
    const pots = calculatePots(players);
    expect(pots).toHaveLength(2);

    // Main pot: 500 × 3 = 1500
    expect(pots[0].amount).toBe(1500);
    expect(pots[0].eligiblePlayerIds).toEqual(['a', 'b', 'c']);

    // Side pot: 700 × 2 = 1400
    expect(pots[1].amount).toBe(1400);
    expect(pots[1].eligiblePlayerIds).toEqual(['b', 'c']);
  });

  it('creates multiple side pots for multiple all-ins', () => {
    const players = [
      makePlayer({ id: 'a', totalBetThisHand: 300, isAllIn: true, chips: 0 }),
      makePlayer({ id: 'b', totalBetThisHand: 800, isAllIn: true, chips: 0 }),
      makePlayer({ id: 'c', totalBetThisHand: 1500 }),
      makePlayer({ id: 'd', totalBetThisHand: 1500 }),
    ];
    const pots = calculatePots(players);
    expect(pots).toHaveLength(3);

    // Pot 1: 300 × 4 = 1200 (all eligible)
    expect(pots[0].amount).toBe(1200);
    expect(pots[0].eligiblePlayerIds).toEqual(['a', 'b', 'c', 'd']);

    // Pot 2: 500 × 3 = 1500 (b, c, d)
    expect(pots[1].amount).toBe(1500);
    expect(pots[1].eligiblePlayerIds).toEqual(['b', 'c', 'd']);

    // Pot 3: 700 × 2 = 1400 (c, d)
    expect(pots[2].amount).toBe(1400);
    expect(pots[2].eligiblePlayerIds).toEqual(['c', 'd']);
  });

  it('handles folded all-in player not eligible for pot', () => {
    const players = [
      makePlayer({ id: 'a', totalBetThisHand: 500, isAllIn: true, isFolded: true, chips: 0 }),
      makePlayer({ id: 'b', totalBetThisHand: 1000 }),
      makePlayer({ id: 'c', totalBetThisHand: 1000 }),
    ];
    const pots = calculatePots(players);

    // Main pot at 500 level: a is folded so not eligible
    expect(pots[0].eligiblePlayerIds).toEqual(['b', 'c']);
  });

  it('returns empty array when no bets', () => {
    const players = [
      makePlayer({ id: 'a', totalBetThisHand: 0 }),
      makePlayer({ id: 'b', totalBetThisHand: 0 }),
    ];
    const pots = calculatePots(players);
    expect(pots).toHaveLength(0);
  });
});

describe('distributePot', () => {
  it('gives full pot to single winner', () => {
    const pot = { amount: 1000, eligiblePlayerIds: ['a', 'b', 'c'] };
    const dist = distributePot(pot, ['a']);
    expect(dist.get('a')).toBe(1000);
    expect(dist.size).toBe(1);
  });

  it('splits pot evenly between multiple winners', () => {
    const pot = { amount: 1000, eligiblePlayerIds: ['a', 'b'] };
    const dist = distributePot(pot, ['a', 'b']);
    expect(dist.get('a')).toBe(500);
    expect(dist.get('b')).toBe(500);
  });

  it('gives odd chip to first winner in list', () => {
    const pot = { amount: 1001, eligiblePlayerIds: ['a', 'b'] };
    const dist = distributePot(pot, ['a', 'b']);
    expect(dist.get('a')).toBe(501);
    expect(dist.get('b')).toBe(500);
  });

  it('handles three-way split with remainder', () => {
    const pot = { amount: 100, eligiblePlayerIds: ['a', 'b', 'c'] };
    const dist = distributePot(pot, ['a', 'b', 'c']);
    expect(dist.get('a')).toBe(34);
    expect(dist.get('b')).toBe(33);
    expect(dist.get('c')).toBe(33);
  });

  it('returns empty map for no winners', () => {
    const pot = { amount: 1000, eligiblePlayerIds: ['a', 'b'] };
    const dist = distributePot(pot, []);
    expect(dist.size).toBe(0);
  });
});
