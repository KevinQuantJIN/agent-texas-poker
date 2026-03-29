import { describe, it, expect } from 'vitest';
import { createMockAdapter } from '../../src/adapters/mock-adapter.js';
import type { ValidActions } from '../../src/engine/types.js';

const checkableActions: ValidActions = {
  canCheck: true,
  canCall: false,
  callAmount: 0,
  minRaise: 200,
  maxRaise: 10000,
};

const callableActions: ValidActions = {
  canCheck: false,
  canCall: true,
  callAmount: 100,
  minRaise: 200,
  maxRaise: 10000,
};

const noRaiseActions: ValidActions = {
  canCheck: false,
  canCall: true,
  callAmount: 100,
  minRaise: 0,
  maxRaise: 0,
};

describe('mock adapter', () => {
  describe('always-call strategy', () => {
    it('calls when possible', () => {
      const adapter = createMockAdapter('always-call');
      const result = adapter(callableActions);
      expect(result.action).toBe('call');
    });

    it('checks when nothing to call', () => {
      const adapter = createMockAdapter('always-call');
      const result = adapter(checkableActions);
      expect(result.action).toBe('check');
    });

    it('folds when cannot call or check', () => {
      const adapter = createMockAdapter('always-call');
      const noActions: ValidActions = {
        canCheck: false,
        canCall: false,
        callAmount: 0,
        minRaise: 0,
        maxRaise: 0,
      };
      const result = adapter(noActions);
      expect(result.action).toBe('fold');
    });
  });

  describe('always-fold strategy', () => {
    it('always folds', () => {
      const adapter = createMockAdapter('always-fold');
      expect(adapter(callableActions).action).toBe('fold');
      expect(adapter(checkableActions).action).toBe('fold');
    });
  });

  describe('always-raise strategy', () => {
    it('raises when possible', () => {
      const adapter = createMockAdapter('always-raise');
      const result = adapter(callableActions);
      expect(result.action).toBe('raise');
      expect(result.amount).toBe(200);
    });

    it('calls when raise not available', () => {
      const adapter = createMockAdapter('always-raise');
      const result = adapter(noRaiseActions);
      expect(result.action).toBe('call');
    });

    it('checks when only check available', () => {
      const adapter = createMockAdapter('always-raise');
      const noRaiseCheck: ValidActions = {
        canCheck: true,
        canCall: false,
        callAmount: 0,
        minRaise: 0,
        maxRaise: 0,
      };
      const result = adapter(noRaiseCheck);
      expect(result.action).toBe('check');
    });
  });

  describe('scripted strategy', () => {
    it('returns scripted actions in order', () => {
      const adapter = createMockAdapter('scripted', [
        { action: 'call', reasoning: 'first' },
        { action: 'raise', amount: 500, reasoning: 'second' },
        { action: 'fold', reasoning: 'third' },
      ]);

      expect(adapter(callableActions).action).toBe('call');
      expect(adapter(callableActions).action).toBe('raise');
      expect(adapter(callableActions).action).toBe('fold');
    });

    it('falls through to always-call after script exhausted', () => {
      const adapter = createMockAdapter('scripted', [{ action: 'fold' }]);
      adapter(callableActions); // consume scripted
      const result = adapter(callableActions);
      expect(result.action).toBe('call'); // falls through to default
    });
  });

  describe('random strategy', () => {
    it('returns valid actions', () => {
      const adapter = createMockAdapter('random');
      // Run multiple times to exercise randomness
      for (let i = 0; i < 20; i++) {
        const result = adapter(callableActions);
        expect(['fold', 'call', 'raise']).toContain(result.action);
      }
    });
  });

  describe('latency simulation', () => {
    it('includes latencyMs in response', () => {
      const adapter = createMockAdapter('always-call');
      const result = adapter(callableActions);
      expect(result.latencyMs).toBeGreaterThanOrEqual(100);
      expect(result.latencyMs).toBeLessThanOrEqual(600);
    });
  });
});
