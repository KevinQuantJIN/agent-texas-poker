import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractJSON,
  parseActionCandidate,
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

describe('parseActionCandidate', () => {
  it('parses a valid fold', () => {
    const result = parseActionCandidate({ action: 'fold', reasoning: 'bad hand' });
    expect(result).toEqual({ action: 'fold', amount: undefined, reasoning: 'bad hand', latencyMs: 0 });
  });

  it('parses a valid check', () => {
    const result = parseActionCandidate({ action: 'check', reasoning: 'free card' });
    expect(result).toEqual({ action: 'check', amount: undefined, reasoning: 'free card', latencyMs: 0 });
  });

  it('parses a valid call', () => {
    const result = parseActionCandidate({ action: 'call', reasoning: 'pot odds' });
    expect(result?.action).toBe('call');
  });

  it('parses a valid raise with amount', () => {
    const result = parseActionCandidate({ action: 'raise', amount: 500, reasoning: 'big raise' });
    expect(result?.action).toBe('raise');
    expect(result?.amount).toBe(500);
  });

  it('parses a raise without amount', () => {
    const result = parseActionCandidate({ action: 'raise', reasoning: 'raise it' });
    expect(result?.action).toBe('raise');
    expect(result?.amount).toBeUndefined();
  });

  it('extracts reasoning as string', () => {
    const result = parseActionCandidate({ action: 'fold', reasoning: 123 });
    expect(result?.reasoning).toBe('');
  });

  it('defaults reasoning to empty string if missing', () => {
    const result = parseActionCandidate({ action: 'fold' });
    expect(result?.reasoning).toBe('');
  });

  it('returns null for unknown action', () => {
    expect(parseActionCandidate({ action: 'bluff', reasoning: 'lol' })).toBeNull();
  });

  it('returns null for null input', () => {
    expect(parseActionCandidate(null)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(parseActionCandidate('fold')).toBeNull();
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

  it('calls when check not available and amount is reasonable', () => {
    const result = fallbackAction(callValidActions);
    expect(result.action).toBe('call');
  });

  it('folds when call amount is too high', () => {
    const expensiveCall: ValidActions = {
      canCheck: false,
      canCall: true,
      callAmount: 5000,
      minRaise: 10000,
      maxRaise: 10000,
    };
    const result = fallbackAction(expensiveCall);
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
  chipsInPot: 100,
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
