import { describe, it, expect } from 'vitest';
import { getValidActions, validateAction, applyAction, formatValidActions } from '@/engine/betting';
import { AgentAction, InternalPlayer } from '@/engine/types';

function makePlayer(overrides: Partial<InternalPlayer> = {}): InternalPlayer {
  return {
    id: 'test',
    name: 'Test',
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

function makeAction(overrides: Partial<AgentAction> = {}): AgentAction {
  return {
    action: 'fold',
    reasoning: 'test',
    latencyMs: 100,
    ...overrides,
  };
}

describe('getValidActions', () => {
  it('allows check when no bet outstanding', () => {
    const player = makePlayer({ currentBet: 0 });
    const va = getValidActions(player, 0, 100, 100);
    expect(va.canCheck).toBe(true);
    expect(va.canCall).toBe(false);
  });

  it('allows call when there is a bet to match', () => {
    const player = makePlayer({ currentBet: 0 });
    const va = getValidActions(player, 200, 100, 100);
    expect(va.canCheck).toBe(false);
    expect(va.canCall).toBe(true);
    expect(va.callAmount).toBe(200);
  });

  it('limits call amount to remaining chips', () => {
    const player = makePlayer({ chips: 100, currentBet: 0 });
    const va = getValidActions(player, 500, 100, 100);
    expect(va.callAmount).toBe(100);
  });

  it('calculates min-raise correctly', () => {
    const player = makePlayer({ currentBet: 0 });
    // Highest bet is 200, last raise was 100
    const va = getValidActions(player, 200, 100, 100);
    // Min raise = 200 (highest) + 100 (last raise increment) = 300 total, minus 0 current bet = 300
    expect(va.minRaise).toBe(300);
  });

  it('returns no raise when chips are too low', () => {
    const player = makePlayer({ chips: 50, currentBet: 0 });
    const va = getValidActions(player, 200, 100, 100);
    // Can only call 50, can't raise since raise would need > 50
    expect(va.maxRaise).toBe(0);
  });

  it('returns no actions for player with 0 chips', () => {
    const player = makePlayer({ chips: 0 });
    const va = getValidActions(player, 0, 100, 100);
    expect(va.canCheck).toBe(false);
    expect(va.canCall).toBe(false);
    expect(va.minRaise).toBe(0);
    expect(va.maxRaise).toBe(0);
  });
});

describe('validateAction', () => {
  it('auto-converts check to call when bet outstanding', () => {
    const player = makePlayer();
    const va = getValidActions(player, 200, 100, 100);
    const action = validateAction(makeAction({ action: 'check' }), player, va);
    expect(action.action).toBe('call');
    expect(action.amount).toBe(200);
  });

  it('auto-converts call to check when nothing to call', () => {
    const player = makePlayer();
    const va = getValidActions(player, 0, 100, 100);
    const action = validateAction(makeAction({ action: 'call' }), player, va);
    expect(action.action).toBe('check');
  });

  it('snaps low raise to min-raise', () => {
    const player = makePlayer();
    const va = getValidActions(player, 200, 100, 100);
    const action = validateAction(makeAction({ action: 'raise', amount: 50 }), player, va);
    expect(action.action).toBe('raise');
    expect(action.amount).toBe(va.minRaise);
  });

  it('snaps high raise to all-in', () => {
    const player = makePlayer({ chips: 5000 });
    const va = getValidActions(player, 200, 100, 100);
    const action = validateAction(makeAction({ action: 'raise', amount: 999999 }), player, va);
    expect(action.action).toBe('raise');
    expect(action.amount).toBe(5000); // all-in
  });

  it('converts raise to call when not enough to raise', () => {
    const player = makePlayer({ chips: 50 });
    const va = getValidActions(player, 200, 100, 100);
    const action = validateAction(makeAction({ action: 'raise', amount: 300 }), player, va);
    expect(action.action).toBe('call');
  });

  it('allows fold always', () => {
    const player = makePlayer();
    const va = getValidActions(player, 200, 100, 100);
    const action = validateAction(makeAction({ action: 'fold' }), player, va);
    expect(action.action).toBe('fold');
  });
});

describe('applyAction', () => {
  it('sets isFolded on fold', () => {
    const player = makePlayer();
    applyAction(makeAction({ action: 'fold' }), player);
    expect(player.isFolded).toBe(true);
  });

  it('does nothing on check', () => {
    const player = makePlayer();
    const chips = player.chips;
    applyAction(makeAction({ action: 'check' }), player);
    expect(player.chips).toBe(chips);
  });

  it('deducts chips on call', () => {
    const player = makePlayer({ chips: 10000 });
    applyAction(makeAction({ action: 'call', amount: 200 }), player);
    expect(player.chips).toBe(9800);
    expect(player.currentBet).toBe(200);
    expect(player.totalBetThisHand).toBe(200);
  });

  it('deducts chips on raise', () => {
    const player = makePlayer({ chips: 10000 });
    applyAction(makeAction({ action: 'raise', amount: 500 }), player);
    expect(player.chips).toBe(9500);
    expect(player.currentBet).toBe(500);
  });

  it('sets isAllIn when chips reach 0', () => {
    const player = makePlayer({ chips: 200 });
    applyAction(makeAction({ action: 'call', amount: 200 }), player);
    expect(player.isAllIn).toBe(true);
    expect(player.chips).toBe(0);
  });
});

describe('formatValidActions', () => {
  it('shows fold and check when no bet', () => {
    const va = getValidActions(makePlayer(), 0, 100, 100);
    const formatted = formatValidActions(va, 0, 0);
    expect(formatted).toContain('fold');
    expect(formatted).toContain('check');
  });

  it('shows fold, call, and raise when bet outstanding', () => {
    const va = getValidActions(makePlayer(), 200, 100, 100);
    const formatted = formatValidActions(va, 0, 200);
    expect(formatted).toContain('fold');
    expect(formatted).toContain('call $200');
    expect(formatted).toContain('raise');
  });
});
