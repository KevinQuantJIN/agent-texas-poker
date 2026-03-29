import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractJSON,
  validateAction,
  getAction,
  resetFailures,
  getConsecutiveFailures,
  recordFailure,
  isCircuitOpen,
  fallbackAction,
} from '../../src/adapters/llm-adapter.js';
import type { ValidActions } from '../../src/engine/types.js';
import type { PromptContext } from '../../src/adapters/prompt.js';

// ---- JSON extraction tests ----

describe('extractJSON', () => {
  it('extracts raw JSON object', () => {
    const result = extractJSON('{"action":"fold","reasoning":"bad hand"}');
    expect(result).toEqual({ action: 'fold', reasoning: 'bad hand' });
  });

  it('extracts JSON from markdown code fences', () => {
    const text = '```json\n{"action":"call","reasoning":"strong hand"}\n```';
    expect(extractJSON(text)).toEqual({ action: 'call', reasoning: 'strong hand' });
  });

  it('extracts JSON from fences without json label', () => {
    const text = '```\n{"action":"raise","amount":500,"reasoning":"bluff"}\n```';
    expect(extractJSON(text)).toEqual({ action: 'raise', amount: 500, reasoning: 'bluff' });
  });

  it('extracts JSON from conversational text', () => {
    const text = 'I think I should raise here. {"action":"raise","amount":400,"reasoning":"good odds"} That is my move.';
    expect(extractJSON(text)).toEqual({ action: 'raise', amount: 400, reasoning: 'good odds' });
  });

  it('returns null for no JSON', () => {
    expect(extractJSON('just some text with no json')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(extractJSON('{action: fold}')).toBeNull();
  });

  it('handles nested braces in reasoning', () => {
    const text = '{"action":"fold","reasoning":"pot odds {bad}"}';
    expect(extractJSON(text)).toEqual({ action: 'fold', reasoning: 'pot odds {bad}' });
  });
});

// ---- Action validation tests ----

const baseValidActions: ValidActions = {
  canCheck: true,
  canCall: false,
  callAmount: 0,
  minRaise: 200,
  maxRaise: 10000,
};

const callValidActions: ValidActions = {
  canCheck: false,
  canCall: true,
  callAmount: 100,
  minRaise: 200,
  maxRaise: 10000,
};

describe('validateAction', () => {
  it('validates a correct fold', () => {
    const result = validateAction({ action: 'fold', reasoning: 'bad hand' }, baseValidActions);
    expect(result).toEqual({ action: 'fold', reasoning: 'bad hand', latencyMs: 0 });
  });

  it('validates a correct check', () => {
    const result = validateAction({ action: 'check', reasoning: 'free card' }, baseValidActions);
    expect(result).toEqual({ action: 'check', reasoning: 'free card', latencyMs: 0 });
  });

  it('auto-converts check to call when check not available', () => {
    const result = validateAction({ action: 'check', reasoning: 'oops' }, callValidActions);
    expect(result?.action).toBe('call');
  });

  it('auto-converts call to check when nothing to call', () => {
    const result = validateAction({ action: 'call', reasoning: 'oops' }, baseValidActions);
    expect(result?.action).toBe('check');
  });

  it('snaps raise amount to minRaise when too low', () => {
    const result = validateAction(
      { action: 'raise', amount: 50, reasoning: 'small raise' },
      baseValidActions,
    );
    expect(result?.action).toBe('raise');
    expect(result?.amount).toBe(200);
  });

  it('snaps raise amount to maxRaise (all-in) when too high', () => {
    const result = validateAction(
      { action: 'raise', amount: 99999, reasoning: 'big raise' },
      baseValidActions,
    );
    expect(result?.action).toBe('raise');
    expect(result?.amount).toBe(10000);
  });

  it('uses minRaise when no amount provided', () => {
    const result = validateAction(
      { action: 'raise', reasoning: 'raise it' },
      baseValidActions,
    );
    expect(result?.amount).toBe(200);
  });

  it('converts raise to call when minRaise is 0', () => {
    const noRaise: ValidActions = { ...callValidActions, minRaise: 0, maxRaise: 0 };
    const result = validateAction({ action: 'raise', amount: 500, reasoning: 'try' }, noRaise);
    expect(result?.action).toBe('call');
  });

  it('returns null for unknown action', () => {
    expect(validateAction({ action: 'bluff', reasoning: 'lol' }, baseValidActions)).toBeNull();
  });

  it('returns null for null input', () => {
    expect(validateAction(null, baseValidActions)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(validateAction('fold', baseValidActions)).toBeNull();
  });
});

// ---- Circuit breaker tests ----

describe('circuit breaker', () => {
  beforeEach(() => {
    resetFailures('test-player');
  });

  it('starts with 0 failures', () => {
    expect(getConsecutiveFailures('test-player')).toBe(0);
    expect(isCircuitOpen('test-player')).toBe(false);
  });

  it('records failures incrementally', () => {
    recordFailure('test-player');
    expect(getConsecutiveFailures('test-player')).toBe(1);
    recordFailure('test-player');
    expect(getConsecutiveFailures('test-player')).toBe(2);
  });

  it('opens circuit after 3 failures', () => {
    recordFailure('test-player');
    recordFailure('test-player');
    expect(isCircuitOpen('test-player')).toBe(false);
    recordFailure('test-player');
    expect(isCircuitOpen('test-player')).toBe(true);
  });

  it('resets failures', () => {
    recordFailure('test-player');
    recordFailure('test-player');
    recordFailure('test-player');
    resetFailures('test-player');
    expect(isCircuitOpen('test-player')).toBe(false);
    expect(getConsecutiveFailures('test-player')).toBe(0);
  });
});

// ---- Fallback action tests ----

describe('fallbackAction', () => {
  it('checks when possible', () => {
    const result = fallbackAction(baseValidActions);
    expect(result.action).toBe('check');
  });

  it('folds when check not available', () => {
    const result = fallbackAction(callValidActions);
    expect(result.action).toBe('fold');
  });
});

// ---- getAction integration tests (with mocked fetch) ----

const mockPromptContext: PromptContext = {
  name: 'TestBot',
  personality: 'Aggressive',
  holeCards: [
    { rank: 'A', suit: 'spades' },
    { rank: 'K', suit: 'hearts' },
  ],
  communityCards: [],
  pot: 300,
  chips: 9900,
  round: 'preflop',
  actionHistory: '',
  validActions: callValidActions,
};

describe('getAction', () => {
  beforeEach(() => {
    resetFailures('player-1');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed action on successful API call', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"action":"call","reasoning":"good hand"}' } }],
      }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as any);

    const result = await getAction({
      playerId: 'player-1',
      providerName: 'openai',
      promptContext: mockPromptContext,
      apiKey: 'test-key',
    });

    expect(result.action).toBe('call');
    expect(result.reasoning).toBe('good hand');
  });

  it('folds on timeout after retry', async () => {
    vi.mocked(fetch).mockImplementation(async () => {
      throw new Error('aborted');
    });

    const result = await getAction({
      playerId: 'player-1',
      providerName: 'openai',
      promptContext: mockPromptContext,
      apiKey: 'test-key',
      timeoutMs: 100,
    });

    expect(result.action).toBe('fold');
    expect(result.reasoning).toContain('aborted');
  });

  it('folds on unparseable response after retry', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'I have no idea what to do' } }],
      }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as any);

    const result = await getAction({
      playerId: 'player-1',
      providerName: 'openai',
      promptContext: mockPromptContext,
      apiKey: 'test-key',
    });

    expect(result.action).toBe('fold');
  });

  it('activates circuit breaker after 3 consecutive failures', async () => {
    vi.mocked(fetch).mockImplementation(async () => {
      throw new Error('network error');
    });

    // Fail 3 times (each getAction has 2 attempts, but records 1 failure total)
    await getAction({ playerId: 'player-1', providerName: 'openai', promptContext: mockPromptContext, apiKey: 'test-key' });
    await getAction({ playerId: 'player-1', providerName: 'openai', promptContext: mockPromptContext, apiKey: 'test-key' });
    await getAction({ playerId: 'player-1', providerName: 'openai', promptContext: mockPromptContext, apiKey: 'test-key' });

    expect(isCircuitOpen('player-1')).toBe(true);

    // Next call should return fallback without calling fetch
    vi.mocked(fetch).mockClear();
    const result = await getAction({
      playerId: 'player-1',
      providerName: 'openai',
      promptContext: mockPromptContext,
      apiKey: 'test-key',
    });

    expect(result.reasoning).toContain('Circuit breaker active');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('folds for unknown provider', async () => {
    const result = await getAction({
      playerId: 'player-1',
      providerName: 'unknown',
      promptContext: mockPromptContext,
      apiKey: 'test-key',
    });

    expect(result.action).toBe('fold');
    expect(result.reasoning).toContain('Unknown provider');
  });

  it('folds for missing API key', async () => {
    const result = await getAction({
      playerId: 'player-1',
      providerName: 'openai',
      promptContext: mockPromptContext,
      // no apiKey, and env var not set
    });

    expect(result.action).toBe('fold');
    expect(result.reasoning).toContain('Missing API key');
  });

  it('retries once then succeeds', async () => {
    let callCount = 0;
    vi.mocked(fetch).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error('transient error');
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"action":"call","reasoning":"retry worked"}' } }],
        }),
      } as any;
    });

    const result = await getAction({
      playerId: 'player-1',
      providerName: 'openai',
      promptContext: mockPromptContext,
      apiKey: 'test-key',
    });

    expect(result.action).toBe('call');
    expect(callCount).toBe(2);
  });

  it('handles HTTP error response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limited',
    } as any);

    const result = await getAction({
      playerId: 'player-1',
      providerName: 'openai',
      promptContext: mockPromptContext,
      apiKey: 'test-key',
    });

    expect(result.action).toBe('fold');
    expect(result.reasoning).toContain('429');
  });
});
