// ============================================================
// Core adapter function — retry, circuit breaker, JSON extraction
// ============================================================

import type { AgentAction, ValidActions } from '../engine/types.js';
import type { ProviderConfig } from './providers.js';
import { PROVIDERS, PROVIDER_API_KEY_ENV, getProviderEndpoint } from './providers.js';
import { buildSystemPrompt, buildUserPrompt, type PromptContext } from './prompt.js';

// ---- JSON extraction ----

export function extractJSON(text: string): object | null {
  // Strip markdown code fences
  text = text.replace(/```json?\n?/g, '').replace(/```/g, '');
  // Find first { and last }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ---- Action validation ----

export function validateAction(
  raw: any,
  validActions: ValidActions,
): AgentAction | null {
  if (!raw || typeof raw !== 'object') return null;

  const reasoning = typeof raw.reasoning === 'string' ? raw.reasoning : '';
  let action = raw.action;

  if (!['fold', 'check', 'call', 'raise'].includes(action)) return null;

  // Auto-convert check↔call per design doc
  if (action === 'check' && !validActions.canCheck) {
    action = validActions.canCall ? 'call' : 'fold';
  }
  if (action === 'call' && !validActions.canCall) {
    action = validActions.canCheck ? 'check' : 'fold';
  }

  // Snap raise to valid range
  if (action === 'raise') {
    if (validActions.minRaise <= 0) {
      // Can't raise — convert to call or check
      action = validActions.canCall ? 'call' : validActions.canCheck ? 'check' : 'fold';
    } else {
      let amount = typeof raw.amount === 'number' ? raw.amount : validActions.minRaise;
      if (amount < validActions.minRaise) amount = validActions.minRaise;
      if (amount > validActions.maxRaise) amount = validActions.maxRaise;
      return { action: 'raise', amount, reasoning, latencyMs: 0 };
    }
  }

  return { action, reasoning, latencyMs: 0 };
}

// ---- Circuit breaker state (per player) ----

const circuitBreakers = new Map<string, number>();

export function getConsecutiveFailures(playerId: string): number {
  return circuitBreakers.get(playerId) ?? 0;
}

export function recordFailure(playerId: string): number {
  const count = (circuitBreakers.get(playerId) ?? 0) + 1;
  circuitBreakers.set(playerId, count);
  return count;
}

export function resetFailures(playerId: string): void {
  circuitBreakers.delete(playerId);
}

export function resetAllFailures(): void {
  circuitBreakers.clear();
}

export function isCircuitOpen(playerId: string): boolean {
  return (circuitBreakers.get(playerId) ?? 0) >= 3;
}

// ---- Rule-based fallback bot ----

export function fallbackAction(validActions: ValidActions): AgentAction {
  // Simple strategy: check if possible, otherwise fold
  if (validActions.canCheck) {
    return { action: 'check', reasoning: 'Bot fallback: checking', latencyMs: 0 };
  }
  return { action: 'fold', reasoning: 'Bot fallback: folding', latencyMs: 0 };
}

// ---- Fetch with timeout + proxy support ----

import { ProxyAgent } from 'undici';

const PROXY_URL = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || '';
const proxyDispatcher = PROXY_URL ? new ProxyAgent(PROXY_URL) : undefined;

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const fetchOptions: any = { ...options, signal: controller.signal };
    if (proxyDispatcher) {
      fetchOptions.dispatcher = proxyDispatcher;
    }
    return await fetch(url, fetchOptions);
  } finally {
    clearTimeout(timer);
  }
}

// ---- Core adapter function ----

export interface GetActionOptions {
  playerId: string;
  providerName: string;
  promptContext: PromptContext;
  timeoutMs?: number;
  apiKey?: string; // override; otherwise read from env
  providerConfig?: ProviderConfig; // override; for dynamic configs like OpenRouter
}

export async function getAction(options: GetActionOptions): Promise<AgentAction> {
  const {
    playerId,
    providerName,
    promptContext,
    timeoutMs = 30_000,
  } = options;

  // Circuit breaker check
  if (isCircuitOpen(playerId)) {
    return {
      ...fallbackAction(promptContext.validActions),
      reasoning: 'Circuit breaker active — experiencing connection issues',
    };
  }

  const config: ProviderConfig | undefined = options.providerConfig ?? PROVIDERS[providerName];
  if (!config) {
    return foldOnError(playerId, promptContext.validActions, `Unknown provider: ${providerName}`);
  }

  const apiKey = options.apiKey ?? process.env[PROVIDER_API_KEY_ENV[providerName] ?? ''] ?? '';
  if (!apiKey) {
    return foldOnError(playerId, promptContext.validActions, `Missing API key for ${providerName}`);
  }

  const systemPrompt = buildSystemPrompt(promptContext.name, promptContext.personality);
  const userPrompt = buildUserPrompt(promptContext);
  const body = config.formatRequest(userPrompt, systemPrompt);
  const headers = config.headers(apiKey);
  const endpoint = getProviderEndpoint(config, apiKey);

  // Retry once on failure
  for (let attempt = 0; attempt < 2; attempt++) {
    const start = Date.now();
    try {
      const response = await fetchWithTimeout(
        endpoint,
        { method: 'POST', headers, body: JSON.stringify(body) },
        timeoutMs,
      );

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }

      const json = await response.json();
      const text = config.parseResponse(json);
      if (!text) {
        throw new Error('Empty response from model');
      }
      const parsed = extractJSON(text);
      const latencyMs = Date.now() - start;

      if (!parsed) {
        throw new Error('Could not extract JSON from response');
      }

      const action = validateAction(parsed, promptContext.validActions);
      if (!action) {
        throw new Error('Invalid action in response');
      }

      action.latencyMs = latencyMs;
      resetFailures(playerId);
      return action;
    } catch (err) {
      if (attempt === 0) {
        // Exponential backoff before retry
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      // Second attempt failed
      return foldOnError(
        playerId,
        promptContext.validActions,
        err instanceof Error ? err.message : 'Unknown error',
      );
    }
  }

  // Should not reach here, but TypeScript needs it
  return foldOnError(playerId, promptContext.validActions, 'Exhausted retries');
}

function foldOnError(
  playerId: string,
  validActions: ValidActions,
  reason: string,
): AgentAction {
  const failures = recordFailure(playerId);
  if (failures >= 3) {
    return {
      ...fallbackAction(validActions),
      reasoning: `Circuit breaker activated (${reason}) — experiencing connection issues`,
    };
  }
  return { action: 'fold', reasoning: `Error: ${reason}`, latencyMs: 0 };
}
