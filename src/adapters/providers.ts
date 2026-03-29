// ============================================================
// Per-provider configs — endpoint, model, formatRequest, parseResponse, headers
// ============================================================

export interface ProviderConfig {
  name: string;
  endpoint: string;
  model: string;
  formatRequest: (prompt: string, systemPrompt: string) => object;
  parseResponse: (response: any) => string;
  headers: (apiKey: string) => Record<string, string>;
}

export const OPENAI_CONFIG: ProviderConfig = {
  name: 'openai',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o',
  formatRequest: (prompt, systemPrompt) => ({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 512,
  }),
  parseResponse: (response) => response.choices[0].message.content,
  headers: (apiKey) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }),
};

export const ANTHROPIC_CONFIG: ProviderConfig = {
  name: 'anthropic',
  endpoint: 'https://api.anthropic.com/v1/messages',
  model: 'claude-sonnet-4-5-20250514',
  formatRequest: (prompt, systemPrompt) => ({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  }),
  parseResponse: (response) => response.content[0].text,
  headers: (apiKey) => ({
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }),
};

export const GOOGLE_CONFIG: ProviderConfig = {
  name: 'google',
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
  model: 'gemini-2.5-flash',
  formatRequest: (prompt, systemPrompt) => ({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
  }),
  parseResponse: (response) => response.candidates[0].content.parts[0].text,
  headers: (_apiKey) => ({
    'Content-Type': 'application/json',
  }),
};

export const XAI_CONFIG: ProviderConfig = {
  name: 'xai',
  endpoint: 'https://api.x.ai/v1/chat/completions',
  model: 'grok-3',
  formatRequest: (prompt, systemPrompt) => ({
    model: 'grok-3',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 512,
  }),
  parseResponse: (response) => response.choices[0].message.content,
  headers: (apiKey) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }),
};

// OpenRouter — OpenAI-compatible API that routes to any model with one key
export function createOpenRouterConfig(model: string): ProviderConfig {
  return {
    name: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model,
    formatRequest: (prompt, systemPrompt) => ({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 512,
    }),
    parseResponse: (response) => response.choices[0].message.content,
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    }),
  };
}

// Registry of all providers
export const PROVIDERS: Record<string, ProviderConfig> = {
  openai: OPENAI_CONFIG,
  anthropic: ANTHROPIC_CONFIG,
  google: GOOGLE_CONFIG,
  xai: XAI_CONFIG,
};

// API key env var mapping
export const PROVIDER_API_KEY_ENV: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
  xai: 'XAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

// Google uses query param auth instead of header
export function getProviderEndpoint(config: ProviderConfig, apiKey: string): string {
  if (config.name === 'google') {
    return `${config.endpoint}?key=${apiKey}`;
  }
  return config.endpoint;
}
