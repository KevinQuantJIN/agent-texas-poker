// ============================================================
// Mock adapter for tests and frontend dev (no API calls)
// ============================================================

import type { AgentAction, ValidActions } from '../engine/types.js';

export interface MockResponse {
  action: 'fold' | 'check' | 'call' | 'raise';
  amount?: number;
  reasoning?: string;
}

export type MockStrategy = 'always-call' | 'always-fold' | 'always-raise' | 'random' | 'scripted';

/**
 * Create a mock adapter that returns predetermined or strategy-based actions.
 * Used for testing and frontend development without API costs.
 */
export function createMockAdapter(
  strategy: MockStrategy = 'always-call',
  scriptedActions?: MockResponse[],
) {
  let actionIndex = 0;

  return function getMockAction(validActions: ValidActions): AgentAction {
    const latencyMs = Math.floor(Math.random() * 500) + 100; // Simulate 100-600ms latency

    if (strategy === 'scripted' && scriptedActions && actionIndex < scriptedActions.length) {
      const scripted = scriptedActions[actionIndex++];
      return {
        action: scripted.action,
        amount: scripted.amount,
        reasoning: scripted.reasoning ?? `Scripted action #${actionIndex}`,
        latencyMs,
      };
    }

    switch (strategy) {
      case 'always-fold':
        return { action: 'fold', reasoning: 'Mock: always fold', latencyMs };

      case 'always-raise':
        if (validActions.minRaise > 0) {
          return {
            action: 'raise',
            amount: validActions.minRaise,
            reasoning: 'Mock: always raise minimum',
            latencyMs,
          };
        }
        if (validActions.canCall) {
          return { action: 'call', reasoning: 'Mock: wanted to raise but calling instead', latencyMs };
        }
        return { action: 'check', reasoning: 'Mock: wanted to raise but checking', latencyMs };

      case 'random': {
        const options: AgentAction[] = [];
        if (validActions.canCheck) {
          options.push({ action: 'check', reasoning: 'Mock: random check', latencyMs });
        }
        if (validActions.canCall) {
          options.push({ action: 'call', reasoning: 'Mock: random call', latencyMs });
        }
        if (validActions.minRaise > 0) {
          options.push({
            action: 'raise',
            amount: validActions.minRaise,
            reasoning: 'Mock: random raise',
            latencyMs,
          });
        }
        options.push({ action: 'fold', reasoning: 'Mock: random fold', latencyMs });
        return options[Math.floor(Math.random() * options.length)];
      }

      case 'always-call':
      default:
        if (validActions.canCall) {
          return { action: 'call', reasoning: 'Mock: always call', latencyMs };
        }
        if (validActions.canCheck) {
          return { action: 'check', reasoning: 'Mock: nothing to call, checking', latencyMs };
        }
        return { action: 'fold', reasoning: 'Mock: cannot call or check, folding', latencyMs };
    }
  };
}
