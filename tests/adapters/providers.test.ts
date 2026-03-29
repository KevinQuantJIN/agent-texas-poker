import { describe, it, expect } from 'vitest';
import {
  OPENAI_CONFIG,
  ANTHROPIC_CONFIG,
  GOOGLE_CONFIG,
  XAI_CONFIG,
  PROVIDERS,
  PROVIDER_API_KEY_ENV,
  getProviderEndpoint,
} from '../../src/adapters/providers.js';

describe('OpenAI config', () => {
  it('formats request correctly', () => {
    const body = OPENAI_CONFIG.formatRequest('user prompt', 'system prompt') as any;
    expect(body.model).toBe('gpt-4o');
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'system prompt' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'user prompt' });
    expect(body.temperature).toBe(0.7);
    expect(body.max_tokens).toBe(512);
  });

  it('parses response correctly', () => {
    const text = OPENAI_CONFIG.parseResponse({
      choices: [{ message: { content: 'hello world' } }],
    });
    expect(text).toBe('hello world');
  });

  it('generates correct headers', () => {
    const headers = OPENAI_CONFIG.headers('sk-test-key');
    expect(headers['Authorization']).toBe('Bearer sk-test-key');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('uses standard endpoint', () => {
    expect(getProviderEndpoint(OPENAI_CONFIG, 'key')).toBe(OPENAI_CONFIG.endpoint);
  });
});

describe('Anthropic config', () => {
  it('formats request correctly', () => {
    const body = ANTHROPIC_CONFIG.formatRequest('user prompt', 'system prompt') as any;
    expect(body.model).toBe('claude-sonnet-4-5-20250514');
    expect(body.system).toBe('system prompt');
    expect(body.messages).toEqual([{ role: 'user', content: 'user prompt' }]);
    expect(body.max_tokens).toBe(512);
  });

  it('parses response correctly', () => {
    const text = ANTHROPIC_CONFIG.parseResponse({
      content: [{ text: 'hello from claude' }],
    });
    expect(text).toBe('hello from claude');
  });

  it('generates correct headers', () => {
    const headers = ANTHROPIC_CONFIG.headers('sk-ant-test');
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('Google config', () => {
  it('formats request correctly', () => {
    const body = GOOGLE_CONFIG.formatRequest('user prompt', 'system prompt') as any;
    expect(body.system_instruction.parts[0].text).toBe('system prompt');
    expect(body.contents[0].parts[0].text).toBe('user prompt');
    expect(body.generationConfig.temperature).toBe(0.7);
    expect(body.generationConfig.maxOutputTokens).toBe(512);
  });

  it('parses response correctly', () => {
    const text = GOOGLE_CONFIG.parseResponse({
      candidates: [{ content: { parts: [{ text: 'hello from gemini' }] } }],
    });
    expect(text).toBe('hello from gemini');
  });

  it('appends API key as query parameter', () => {
    const url = getProviderEndpoint(GOOGLE_CONFIG, 'google-key');
    expect(url).toContain('?key=google-key');
    expect(url).toContain(GOOGLE_CONFIG.endpoint);
  });
});

describe('xAI config', () => {
  it('formats request correctly', () => {
    const body = XAI_CONFIG.formatRequest('user prompt', 'system prompt') as any;
    expect(body.model).toBe('grok-3');
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'system prompt' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'user prompt' });
  });

  it('parses response correctly', () => {
    const text = XAI_CONFIG.parseResponse({
      choices: [{ message: { content: 'hello from grok' } }],
    });
    expect(text).toBe('hello from grok');
  });

  it('generates correct headers', () => {
    const headers = XAI_CONFIG.headers('xai-key');
    expect(headers['Authorization']).toBe('Bearer xai-key');
  });
});

describe('provider registry', () => {
  it('contains all 4 providers', () => {
    expect(Object.keys(PROVIDERS)).toEqual(['openai', 'anthropic', 'google', 'xai']);
  });

  it('maps correct env var names', () => {
    expect(PROVIDER_API_KEY_ENV['openai']).toBe('OPENAI_API_KEY');
    expect(PROVIDER_API_KEY_ENV['anthropic']).toBe('ANTHROPIC_API_KEY');
    expect(PROVIDER_API_KEY_ENV['google']).toBe('GOOGLE_API_KEY');
    expect(PROVIDER_API_KEY_ENV['xai']).toBe('XAI_API_KEY');
  });
});
