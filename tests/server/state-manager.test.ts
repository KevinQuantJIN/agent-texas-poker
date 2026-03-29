import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '@/server/state-manager';
import type { AgentThought, GameState } from '@/engine/types';

function makeThought(id: string, n: number): AgentThought {
  return {
    playerId: id,
    playerName: `Player ${id}`,
    color: '#D4A574',
    reasoning: `Thought #${n}`,
    action: { action: 'call', reasoning: '', latencyMs: 100 },
    handNumber: 1,
    round: 'flop',
    timestamp: Date.now() + n,
  };
}

describe('StateManager', () => {
  let sm: StateManager;

  beforeEach(() => {
    sm = new StateManager();
  });

  describe('speed control', () => {
    it('defaults to 1x speed', () => {
      expect(sm.getSpeed()).toBe(1);
    });

    it('sets valid speeds', () => {
      sm.setSpeed(2);
      expect(sm.getSpeed()).toBe(2);
      sm.setSpeed(0.5);
      expect(sm.getSpeed()).toBe(0.5);
      sm.setSpeed(5);
      expect(sm.getSpeed()).toBe(5);
    });

    it('ignores invalid speeds', () => {
      sm.setSpeed(3);
      expect(sm.getSpeed()).toBe(1);
    });
  });

  describe('timing', () => {
    it('returns base timing at 1x', () => {
      expect(sm.getTiming('actionDisplay')).toBe(2000);
      expect(sm.getTiming('dealAnimation')).toBe(1000);
    });

    it('halves timing at 2x', () => {
      sm.setSpeed(2);
      expect(sm.getTiming('actionDisplay')).toBe(1000);
    });

    it('doubles timing at 0.5x', () => {
      sm.setSpeed(0.5);
      expect(sm.getTiming('actionDisplay')).toBe(4000);
    });

    it('divides by 5 at 5x', () => {
      sm.setSpeed(5);
      expect(sm.getTiming('actionDisplay')).toBe(400);
    });
  });

  describe('pacing', () => {
    it('waits when LLM is faster than min display', async () => {
      sm.setSpeed(5); // 400ms min at 5x
      const start = Date.now();
      await sm.waitForPacing(100); // LLM took 100ms, need to wait ~300ms
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(250); // some tolerance
    });

    it('does not wait when LLM is slower than min display', async () => {
      const start = Date.now();
      await sm.waitForPacing(5000); // LLM took 5s, min is 2s
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('reasoning buffer', () => {
    it('stores thoughts', () => {
      sm.addThought(makeThought('a', 1));
      expect(sm.getReasoningBuffer()).toHaveLength(1);
    });

    it('limits to 20 entries', () => {
      for (let i = 0; i < 25; i++) {
        sm.addThought(makeThought('a', i));
      }
      const buffer = sm.getReasoningBuffer();
      expect(buffer).toHaveLength(20);
      // Should have the most recent 20
      expect(buffer[0].reasoning).toBe('Thought #5');
      expect(buffer[19].reasoning).toBe('Thought #24');
    });

    it('returns a copy', () => {
      sm.addThought(makeThought('a', 1));
      const buf = sm.getReasoningBuffer();
      buf.pop();
      expect(sm.getReasoningBuffer()).toHaveLength(1);
    });
  });

  describe('game state', () => {
    it('stores and retrieves game state', () => {
      const state = { handNumber: 1 } as GameState;
      sm.setGameState(state);
      expect(sm.getGameState()).toEqual(state);
    });

    it('returns null before any state set', () => {
      expect(sm.getGameState()).toBeNull();
    });

    it('resets everything', () => {
      sm.addThought(makeThought('a', 1));
      sm.setGameState({ handNumber: 1 } as GameState);
      sm.reset();
      expect(sm.getReasoningBuffer()).toHaveLength(0);
      expect(sm.getGameState()).toBeNull();
    });
  });
});
