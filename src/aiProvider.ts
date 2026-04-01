/**
 * AI Provider Abstraction Layer
 *
 * Provides a unified interface for AI operations (OCR, summarization, validation)
 * that can route to different providers: OpenAI direct, Claude via HAI proxy, or OpenAI via HAI proxy.
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// Types and Enums
// ============================================================================

export enum ProviderType {
  OPENAI = 'openai',
  HAI_CLAUDE = 'hai-claude',
  HAI_OPENAI = 'hai-openai',
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
}

export interface AIProviderConfig {
  type: ProviderType;
  apiKey?: string;
  baseURL?: string;
  models?: ModelMapping;
  autoStartProxy?: boolean;
}

// ============================================================================
// Provider Interface
// ============================================================================

export interface AIProvider {
  /**
   * Generate a completion with vision capabilities (for OCR)
   * @param prompt The text prompt/instructions
   * @param imageBase64 Base64-encoded image data
   * @param mimeType Image MIME type (e.g., 'image/jpeg')
   * @param modelType Type of operation (determines which model to use)
   */
  generateVisionCompletion(
    prompt: string,
    imageBase64: string,
    mimeType: string,
    modelType: ModelType
  ): Promise<AIResponse>;

  /**
   * Generate a text completion (for summarization and validation)
   * @param prompt The text prompt/instructions
   * @param modelType Type of operation (determines which model to use)
   */
  generateTextCompletion(
    prompt: string,
    modelType: ModelType
  ): Promise<AIResponse>;

  /**
   * Get the provider type
   */
  getProviderType(): ProviderType;

  /**
   * Get the model being used for a specific operation type
   */
  getModelForType(modelType: ModelType): string;
}

// ============================================================================
// OpenAI Provider Implementation
// ============================================================================

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private config: AIProviderConfig;
  private modelDefaults: ModelMapping = {
    ocr: 'gpt-4o',
    summarization: 'gpt-4o-mini',
    validation: 'gpt-4o-mini',
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
    modelType: ModelType
  ): Promise<AIResponse> {
    const model = this.getModelForType(modelType);

    const response = await this.client.chat.completions.create({
      model,
      temperature: 0.0,
      top_p: 1.0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      max_tokens: 5000,
    });

    return this.normalizeResponse(response);
  }

  async generateTextCompletion(
    prompt: string,
    modelType: ModelType
  ): Promise<AIResponse> {
    const model = this.getModelForType(modelType);

    const response = await this.client.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 4096,
    });

    return this.normalizeResponse(response);
  }

  getProviderType(): ProviderType {
    return this.config.type;
  }

  getModelForType(modelType: ModelType): string {
    return this.config.models?.[modelType] || this.modelDefaults[modelType] || this.modelDefaults.ocr!;
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

// ============================================================================
// Claude Provider Implementation (via HAI proxy)
// ============================================================================

export class ClaudeProvider implements AIProvider {
  private client: Anthropic;
  private config: AIProviderConfig;
  private modelDefaults: ModelMapping = {
    ocr: 'anthropic--claude-4.5-sonnet',
    summarization: 'anthropic--claude-4.5-haiku',
    validation: 'anthropic--claude-4.5-haiku',
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
    modelType: ModelType
  ): Promise<AIResponse> {
    const model = this.getModelForType(modelType);

    // Anthropic uses a different format: media_type must be 'image/jpeg', 'image/png', 'image/gif', or 'image/webp'
    const mediaType = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';

    const response = await this.client.messages.create({
      model,
      max_tokens: 5000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: imageBase64,
              },
            },
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

  async generateTextCompletion(
    prompt: string,
    modelType: ModelType
  ): Promise<AIResponse> {
    const model = this.getModelForType(modelType);

    const response = await this.client.messages.create({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    return this.normalizeResponse(response);
  }

  getProviderType(): ProviderType {
    return this.config.type;
  }

  getModelForType(modelType: ModelType): string {
    return this.config.models?.[modelType] || this.modelDefaults[modelType] || this.modelDefaults.ocr!;
  }

  private normalizeResponse(response: Anthropic.Message): AIResponse {
    // Extract text content from Anthropic response
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

// ============================================================================
// Provider Factory
// ============================================================================

/**
 * Create an AI provider based on configuration
 * This is the main entry point for creating providers
 */
export function createAIProvider(config: AIProviderConfig): AIProvider {
  // Validate required configuration
  if (!config.type) {
    throw new Error('AI provider type is required');
  }

  // Validate API key for providers that need it
  if (config.type === ProviderType.OPENAI || config.type === ProviderType.HAI_OPENAI) {
    if (!config.apiKey) {
      throw new Error(
        'OPENAI_API_KEY is required for OpenAI provider.\n' +
        'Set it in your .env file or environment variables.'
      );
    }
  }

  if (config.type === ProviderType.HAI_CLAUDE) {
    if (!config.apiKey) {
      throw new Error(
        'ANTHROPIC_AUTH_TOKEN or HAI_API_KEY is required for HAI Claude provider.\n' +
        'These are typically set automatically when HAI proxy is configured.'
      );
    }
  }

  // Create appropriate provider
  switch (config.type) {
    case ProviderType.OPENAI:
    case ProviderType.HAI_OPENAI:
      return new OpenAIProvider(config);

    case ProviderType.HAI_CLAUDE:
      return new ClaudeProvider(config);

    default:
      throw new Error(`Unsupported provider type: ${config.type}`);
  }
}



