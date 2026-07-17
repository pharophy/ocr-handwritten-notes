import { afterEach, describe, expect, it } from 'vitest';
import { ProviderType } from '../src/aiProvider';
import { loadAIProviderConfig } from '../src/handwritingReference';

const ENV_KEYS = [
  'AI_PROVIDER',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'AI_MODEL_OCR',
  'AI_MODEL_SUMMARIZATION',
  'AI_MODEL_VALIDATION',
  'AI_MODEL_OCR_FALLBACK',
  'OPENAI_MODEL_OCR',
  'OPENAI_MODEL_SUMMARIZATION',
  'OPENAI_MODEL_VALIDATION',
];

function clearProviderEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

describe('AI provider configuration', () => {
  afterEach(() => {
    clearProviderEnv();
  });

  it('uses explicit OpenAI provider configuration', async () => {
    clearProviderEnv();
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'openai-key';
    process.env.AI_MODEL_OCR = 'gpt-5-mini';

    const config = await loadAIProviderConfig();

    expect(config.type).toBe(ProviderType.OPENAI);
    expect(config.apiKey).toBe('openai-key');
    expect(config.baseURL).toBeUndefined();
    expect(config.models?.ocr).toBe('gpt-5-mini');
  });

  it('uses explicit Anthropic provider configuration with auth token and base URL', async () => {
    clearProviderEnv();
    process.env.AI_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_AUTH_TOKEN = 'anthropic-token';
    process.env.ANTHROPIC_BASE_URL = 'https://anthropic.example.test';
    process.env.AI_MODEL_OCR = 'claude-sonnet-4-20250514';

    const config = await loadAIProviderConfig();

    expect(config.type).toBe(ProviderType.ANTHROPIC);
    expect(config.apiKey).toBe('anthropic-token');
    expect(config.baseURL).toBe('https://anthropic.example.test');
    expect(config.models?.ocr).toBe('claude-sonnet-4-20250514');
  });

  it('infers OpenAI when only OPENAI_API_KEY is set', async () => {
    clearProviderEnv();
    process.env.OPENAI_API_KEY = 'openai-key';

    const config = await loadAIProviderConfig();

    expect(config.type).toBe(ProviderType.OPENAI);
  });

  it('infers Anthropic when only Anthropic credentials are set', async () => {
    clearProviderEnv();
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';

    const config = await loadAIProviderConfig();

    expect(config.type).toBe(ProviderType.ANTHROPIC);
    expect(config.apiKey).toBe('anthropic-key');
  });

  it('requires explicit provider when both provider credentials exist', async () => {
    clearProviderEnv();
    process.env.OPENAI_API_KEY = 'openai-key';
    process.env.ANTHROPIC_AUTH_TOKEN = 'anthropic-token';

    await expect(loadAIProviderConfig()).rejects.toThrow('Both OpenAI and Anthropic credentials');
  });

  it('rejects removed provider values', async () => {
    clearProviderEnv();
    process.env.AI_PROVIDER = 'hai';

    await expect(loadAIProviderConfig()).rejects.toThrow('Supported values: openai, anthropic');
  });

  it('rejects legacy prefixed Anthropic model aliases', async () => {
    clearProviderEnv();
    process.env.AI_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
    process.env.AI_MODEL_OCR = 'anthropic--claude-4.6-sonnet';

    await expect(loadAIProviderConfig()).rejects.toThrow('legacy prefixed Claude alias');
  });
});
