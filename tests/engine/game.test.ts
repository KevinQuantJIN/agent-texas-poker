import { describe, it, expect } from 'vitest';
import { Game, AgentConfig, GameEvent } from '@/engine/game';
import { AgentAction, ValidActions, PlayerState, GameState } from '@/engine/types';

function makeAgents(n: number): AgentConfig[] {
  const names = ['Claude', 'GPT-4o', 'Gemini', 'Grok', 'DeepSeek', 'Llama'];
  return Array.from({ length: n }, (_, i) => ({
    id: `player-${i}`,
    name: names[i] ?? `Player-${i}`,
    provider: 'test',
    model: 'test',
    seatIndex: i,
  }));
}

/** Creates a getAction that returns predetermined actions in order. */
function scriptedActions(actions: AgentAction[]) {
  let idx = 0;
  return async () => {
    if (idx < actions.length) {
      return actions[idx++];
    }
    // Default: fold
    return { action: 'fold' as const, reasoning: 'default fold', latencyMs: 10 };
  };
}

/** Creates a getAction that always returns the same action. */
function constantAction(action: AgentAction['action'], amount?: number) {
  return async () => ({
    action,
    amount,
    reasoning: `always ${action}`,
    latencyMs: 10,
  } as AgentAction);
}

describe('Game', () => {
  it('completes a hand with all folds', async () => {
    const events: GameEvent[] = [];
    const game = new Game(
      makeAgents(3),
      constantAction('fold'),
      (e) => events.push(e),
      { seed: 'test-fold', maxHands: 1, startingChips: 1000, blinds: { small: 50, big: 100 } }
    );

    await game.run();

    const handEnd = events.find(e => e.type === 'handEnd');
    expect(handEnd).toBeDefined();

    // Someone won the pot (blinds)
    if (handEnd?.type === 'handEnd') {
      expect(handEnd.winners.size).toBeGreaterThan(0);
      const totalWon = [...handEnd.winners.values()].reduce((a, b) => a + b, 0);
      expect(totalWon).toBe(150); // SB + BB
    }
  });

  it('completes a hand with all calls to showdown', async () => {
    const events: GameEvent[] = [];
    const game = new Game(
      makeAgents(3),
      constantAction('call'),
      (e) => events.push(e),
      { seed: 'test-call', maxHands: 1, startingChips: 1000, blinds: { small: 50, big: 100 } }
    );

    await game.run();

    const roundChanges = events.filter(e => e.type === 'roundChange');
    // Should go through flop, turn, river
    expect(roundChanges.length).toBe(3);

    const handEnd = events.find(e => e.type === 'handEnd');
    expect(handEnd).toBeDefined();
  });

  it('runs multiple hands and advances dealer', async () => {
    const events: GameEvent[] = [];
    const game = new Game(
      makeAgents(3),
      constantAction('fold'),
      (e) => events.push(e),
      { seed: 'test-multi', maxHands: 3, startingChips: 1000, blinds: { small: 50, big: 100 } }
    );

    await game.run();

    const handStarts = events.filter(e => e.type === 'handStart');
    expect(handStarts.length).toBe(3);

    // Dealer should rotate
    const dealerIndices = handStarts.map(e => e.type === 'handStart' ? e.dealerIndex : -1);
    expect(dealerIndices[0]).not.toBe(dealerIndices[1]);
  });

  it('eliminates players who lose all chips', async () => {
    const events: GameEvent[] = [];
    // All-in every hand — someone will get eliminated eventually
    const game = new Game(
      makeAgents(2),
      constantAction('raise', 999999), // always go all-in
      (e) => events.push(e),
      { seed: 'test-elim', startingChips: 500, blinds: { small: 50, big: 100 } }
    );

    await game.run();

    const gameOver = events.find(e => e.type === 'gameOver');
    expect(gameOver).toBeDefined();
    if (gameOver?.type === 'gameOver') {
      expect(gameOver.winner.chips).toBeGreaterThan(0);
    }
  });

  it('ends game when only one player remains', async () => {
    const events: GameEvent[] = [];
    const game = new Game(
      makeAgents(2),
      constantAction('raise', 999999),
      (e) => events.push(e),
      { seed: 'test-endgame', startingChips: 200, blinds: { small: 50, big: 100 } }
    );

    await game.run();

    const gameOver = events.find(e => e.type === 'gameOver');
    expect(gameOver).toBeDefined();
  });

  it('handles heads-up blind posting correctly', async () => {
    const events: GameEvent[] = [];
    let blindActions: { playerId: string; bet: number }[] = [];

    const game = new Game(
      makeAgents(2),
      async (player, gameState) => {
        // Track initial bets (blinds)
        return { action: 'fold' as const, reasoning: 'test', latencyMs: 10 };
      },
      (e) => events.push(e),
      { seed: 'test-headsup', maxHands: 1, startingChips: 1000, blinds: { small: 50, big: 100 } }
    );

    await game.run();

    // In heads-up, dealer posts SB. Check that both players posted blinds.
    const handEnd = events.find(e => e.type === 'handEnd');
    expect(handEnd).toBeDefined();
    if (handEnd?.type === 'handEnd') {
      const totalWon = [...handEnd.winners.values()].reduce((a, b) => a + b, 0);
      expect(totalWon).toBe(150); // 50 + 100 blinds
    }
  });
});
