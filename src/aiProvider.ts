/**
 * AI Provider Abstraction Layer
 *
 * Provides a unified interface for direct OpenAI and direct Anthropic API usage.
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export enum ProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
}

export function isAnthropic(model: string): boolean {
  return model.startsWith('claude-');
}

export function isOpenAI(model: string): boolean {
  return model.startsWith('gpt-') || model.startsWith('gpt4') || model.startsWith('gpt5');
}

export type ModelType = 'ocr' | 'summarization' | 'validation';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
  }>;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ModelMapping {
  ocr?: string;
  summarization?: string;
  validation?: string;
  ocrFallback?: string;
}

export interface AIProviderConfig {
  type: ProviderType;
  apiKey?: string;
  baseURL?: string;
  models?: ModelMapping;
}

/** An additional image sent before the target image (e.g. a handwriting reference). */
export interface VisionImage {
  base64: string;
  mimeType: string;
}

export interface VisionOptions {
  /** Images sent before the target image, in order. */
  extraImages?: VisionImage[];
  /** Image detail level. Honored by OpenAI; ignored by providers without the setting. */
  detail?: 'low' | 'high' | 'auto';
}

export interface AIProvider {
  generateVisionCompletion(
    prompt: string,
    imageBase64: string,
    mimeType: string,
    modelType: ModelType,
    options?: VisionOptions
  ): Promise<AIResponse>;

  generateTextCompletion(
    prompt: string,
    modelType: ModelType
  ): Promise<AIResponse>;

  getProviderType(): ProviderType;
  getModelForType(modelType: ModelType): string;
  getProviderConfig(): AIProviderConfig;
}

/** Models that take max_completion_tokens (gpt-4.1, gpt-5 and later, o-series). */
export function usesCompletionTokenBudget(model: string): boolean {
  return /^gpt-(4\.1|[5-9])/.test(model) || /^o\d/.test(model);
}

/** Reasoning models that accept reasoning_effort (gpt-5 and later, o-series). */
export function supportsReasoningEffort(model: string): boolean {
  return /^gpt-[5-9]/.test(model) || /^o\d/.test(model);
}

/** Optional OCR_REASONING_EFFORT (minimal | low | medium | high) for OCR vision calls. */
function ocrReasoningEffort(model: string, modelType: ModelType): string | undefined {
  const effort = process.env.OCR_REASONING_EFFORT;
  if (modelType !== 'ocr' || !effort || !supportsReasoningEffort(model)) return undefined;
  return ['minimal', 'low', 'medium', 'high'].includes(effort) ? effort : undefined;
}

// Reasoning models (gpt-5+, gpt-4.1*) count hidden reasoning tokens against
// max_completion_tokens. If the budget only covers the visible answer, reasoning can
// consume it entirely and the response comes back with empty content
// (finish_reason: 'length'). These budgets leave ample headroom for reasoning + output.
const REASONING_MAX_COMPLETION_TOKENS = 16000;
// Legacy (non-reasoning) models bill max_tokens against visible output only.
const LEGACY_MAX_TOKENS_VISION = 5000;
const LEGACY_MAX_TOKENS_TEXT = 4096;

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private config: AIProviderConfig;
  private modelDefaults: ModelMapping = {
    ocr: 'gpt-5-mini',
    summarization: 'gpt-5-mini',
    validation: 'gpt-5-mini',
  };

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  async generateVisionCompletion(
    prompt: string,
    imageBase64: string,
    mimeType: string,
    modelType: ModelType,
    options?: VisionOptions
  ): Promise<AIResponse> {
    const model = this.getModelForType(modelType);
    const isNewModel = usesCompletionTokenBudget(model);
    const imagePart = (data: string, mime: string) => ({
      type: 'image_url' as const,
      image_url: options?.detail
        ? { url: `data:${mime};base64,${data}`, detail: options.detail }
        : { url: `data:${mime};base64,${data}` },
    });
    const images = [
      ...(options?.extraImages ?? []).map(img => imagePart(img.base64, img.mimeType)),
      imagePart(imageBase64, mimeType),
    ];
    const tokenParams: any = isNewModel
      ? { max_completion_tokens: REASONING_MAX_COMPLETION_TOKENS }
      : { max_tokens: LEGACY_MAX_TOKENS_VISION };

    const response = await this.client.chat.completions.create({
      model,
      top_p: 1.0,
      messages: [
        {
          role: 'user',
          content: [
            ...images,
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      ...tokenParams,
      ...(ocrReasoningEffort(model, modelType) ? { reasoning_effort: ocrReasoningEffort(model, modelType) } : {}),
    });

    return this.normalizeResponse(response);
  }

  async generateTextCompletion(prompt: string, modelType: ModelType): Promise<AIResponse> {
    const model = this.getModelForType(modelType);
    const isNewModel = usesCompletionTokenBudget(model);
    const tokenParams: any = isNewModel
      ? { max_completion_tokens: REASONING_MAX_COMPLETION_TOKENS }
      : { max_tokens: LEGACY_MAX_TOKENS_TEXT };

    const response = await this.client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      ...tokenParams,
    });

    return this.normalizeResponse(response);
  }

  getProviderType(): ProviderType {
    return this.config.type;
  }

  getModelForType(modelType: ModelType): string {
    return this.config.models?.[modelType] || this.modelDefaults[modelType] || this.modelDefaults.ocr!;
  }

  getProviderConfig(): AIProviderConfig {
    return this.config;
  }

  private normalizeResponse(response: OpenAI.Chat.Completions.ChatCompletion): AIResponse {
    return {
      content: response.choices[0]?.message?.content?.trim() || '',
      model: response.model,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }
}

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  private config: AIProviderConfig;
  private modelDefaults: ModelMapping = {
    ocr: 'claude-sonnet-4-20250514',
    summarization: 'claude-3-5-haiku-20241022',
    validation: 'claude-3-5-haiku-20241022',
  };

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  async generateVisionCompletion(
    prompt: string,
    imageBase64: string,
    mimeType: string,
    modelType: ModelType,
    options?: VisionOptions
  ): Promise<AIResponse> {
    const model = this.getModelForType(modelType);
    // Anthropic has no per-image detail setting; options.detail is ignored.
    const imageBlock = (data: string, mime: string) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: (mime.startsWith('image/') ? mime : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data,
      },
    });
    const images = [
      ...(options?.extraImages ?? []).map(img => imageBlock(img.base64, img.mimeType)),
      imageBlock(imageBase64, mimeType),
    ];

    const response = await this.client.messages.create({
      model,
      max_tokens: 5000,
      messages: [
        {
          role: 'user',
          content: [
            ...images,
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    return this.normalizeResponse(response);
  }

  async generateTextCompletion(prompt: string, modelType: ModelType): Promise<AIResponse> {
    const model = this.getModelForType(modelType);

    const response = await this.client.messages.create({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    return this.normalizeResponse(response);
  }

  getProviderType(): ProviderType {
    return this.config.type;
  }

  getModelForType(modelType: ModelType): string {
    return this.config.models?.[modelType] || this.modelDefaults[modelType] || this.modelDefaults.ocr!;
  }

  getProviderConfig(): AIProviderConfig {
    return this.config;
  }

  private normalizeResponse(response: Anthropic.Message): AIResponse {
    const textContent = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as Anthropic.TextBlock).text)
      .join('');

    return {
      content: textContent.trim(),
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }
}

export function createAIProvider(config: AIProviderConfig): AIProvider {
  if (!config.type) {
    throw new Error('AI provider type is required');
  }

  if (config.type === ProviderType.OPENAI) {
    if (!config.apiKey) {
      throw new Error(
        'OPENAI_API_KEY is required for OpenAI provider.\n' +
        'Set it in your .env file or environment variables.'
      );
    }
    return new OpenAIProvider(config);
  }

  if (config.type === ProviderType.ANTHROPIC) {
    if (!config.apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is required for Anthropic provider.\n' +
        'Set one in your .env file or environment variables.'
      );
    }
    return new AnthropicProvider(config);
  }

  throw new Error(`Unsupported provider type: ${config.type}. Supported values: openai, anthropic.`);
}
