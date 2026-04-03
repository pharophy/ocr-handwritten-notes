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
  OPENAI = 'openai',  // Direct OpenAI API
  HAI = 'hai',        // HAI proxy (auto-routes based on model)
}

/**
 * Helper function to determine the correct HAI endpoint based on model name
 */
export function getHAIEndpointForModel(model: string, proxyPort: number = 6655): string {
  if (model.startsWith('anthropic--')) {
    return `http://localhost:${proxyPort}/anthropic/`;
  } else if (model.startsWith('gpt-') || model.startsWith('gpt4') || model.startsWith('gpt5')) {
    return `http://localhost:${proxyPort}/openai/v1`;
  }
  // Default to OpenAI endpoint for unknown models
  return `http://localhost:${proxyPort}/openai/v1`;
}

/**
 * Helper function to determine if a model is Claude
 */
export function isClaude(model: string): boolean {
  return model.startsWith('anthropic--');
}

/**
 * Helper function to determine if a model is OpenAI
 */
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

  /**
   * Get the full provider configuration
   */
  getProviderConfig(): AIProviderConfig;
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

    // GPT-5 and GPT-4.1 models require max_completion_tokens instead of max_tokens
    const isNewModel = model.startsWith('gpt-5') || model.startsWith('gpt-4.1');
    const tokenParams: any = isNewModel
      ? { max_completion_tokens: 5000 }
      : { max_tokens: 5000 };

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
      ...tokenParams,
    });

    return this.normalizeResponse(response);
  }

  async generateTextCompletion(
    prompt: string,
    modelType: ModelType
  ): Promise<AIResponse> {
    const model = this.getModelForType(modelType);

    // GPT-5 and GPT-4.1 models require max_completion_tokens instead of max_tokens
    const isNewModel = model.startsWith('gpt-5') || model.startsWith('gpt-4.1');
    const tokenParams: any = isNewModel
      ? { max_completion_tokens: 4096 }
      : { max_tokens: 4096 };

    const response = await this.client.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
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

  getProviderConfig(): AIProviderConfig {
    return this.config;
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
// HAI Provider Implementation (Dynamic routing for Claude and OpenAI)
// ============================================================================

export class HAIProvider implements AIProvider {
  private config: AIProviderConfig;
  private proxyPort: number;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.proxyPort = parseInt(process.env.HAI_PROXY_PORT || '6655', 10);
  }

  async generateVisionCompletion(
    prompt: string,
    imageBase64: string,
    mimeType: string,
    modelType: ModelType
  ): Promise<AIResponse> {
    const model = this.getModelForType(modelType);

    // Determine which provider to use based on model name
    if (isClaude(model)) {
      return this.generateClaudeVision(prompt, imageBase64, mimeType, model);
    } else {
      return this.generateOpenAIVision(prompt, imageBase64, mimeType, model);
    }
  }

  async generateTextCompletion(
    prompt: string,
    modelType: ModelType
  ): Promise<AIResponse> {
    const model = this.getModelForType(modelType);

    // Determine which provider to use based on model name
    if (isClaude(model)) {
      return this.generateClaudeText(prompt, model);
    } else {
      return this.generateOpenAIText(prompt, model);
    }
  }

  private async generateClaudeVision(
    prompt: string,
    imageBase64: string,
    mimeType: string,
    model: string
  ): Promise<AIResponse> {
    const client = new Anthropic({
      apiKey: this.config.apiKey,
      baseURL: getHAIEndpointForModel(model, this.proxyPort),
    });

    const mediaType = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';

    const response = await client.messages.create({
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

    return this.normalizeAnthropicResponse(response);
  }

  private async generateOpenAIVision(
    prompt: string,
    imageBase64: string,
    mimeType: string,
    model: string
  ): Promise<AIResponse> {
    const client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: getHAIEndpointForModel(model, this.proxyPort),
    });

    const isNewModel = model.startsWith('gpt-5') || model.startsWith('gpt-4.1');
    const tokenParams: any = isNewModel
      ? { max_completion_tokens: 5000 }
      : { max_tokens: 5000 };

    const response = await client.chat.completions.create({
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
      ...tokenParams,
    });

    return this.normalizeOpenAIResponse(response);
  }

  private async generateClaudeText(prompt: string, model: string): Promise<AIResponse> {
    const client = new Anthropic({
      apiKey: this.config.apiKey,
      baseURL: getHAIEndpointForModel(model, this.proxyPort),
    });

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    return this.normalizeAnthropicResponse(response);
  }

  private async generateOpenAIText(prompt: string, model: string): Promise<AIResponse> {
    const client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: getHAIEndpointForModel(model, this.proxyPort),
    });

    const isNewModel = model.startsWith('gpt-5') || model.startsWith('gpt-4.1');
    const tokenParams: any = isNewModel
      ? { max_completion_tokens: 4096 }
      : { max_tokens: 4096 };

    const response = await client.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      ...tokenParams,
    });

    return this.normalizeOpenAIResponse(response);
  }

  getProviderType(): ProviderType {
    return this.config.type;
  }

  getModelForType(modelType: ModelType): string {
    // Default models based on model type
    const defaults: Record<ModelType, string> = {
      ocr: 'anthropic--claude-4.6-sonnet',
      summarization: 'anthropic--claude-4.5-haiku',
      validation: 'anthropic--claude-4.5-haiku',
    };

    return this.config.models?.[modelType] || defaults[modelType];
  }

  getProviderConfig(): AIProviderConfig {
    return this.config;
  }

  private normalizeOpenAIResponse(response: OpenAI.Chat.Completions.ChatCompletion): AIResponse {
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

  private normalizeAnthropicResponse(response: Anthropic.Message): AIResponse {
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
  if (config.type === ProviderType.OPENAI) {
    if (!config.apiKey) {
      throw new Error(
        'OPENAI_API_KEY is required for OpenAI provider.\n' +
        'Set it in your .env file or environment variables.'
      );
    }
  }

  if (config.type === ProviderType.HAI) {
    if (!config.apiKey) {
      throw new Error(
        'ANTHROPIC_AUTH_TOKEN or HAI_API_KEY is required for HAI provider.\n' +
        'These are typically set automatically when HAI proxy is configured.\n' +
        'The same token is used for both Claude and OpenAI endpoints.'
      );
    }
  }

  // Create appropriate provider
  switch (config.type) {
    case ProviderType.OPENAI:
      return new OpenAIProvider(config);

    case ProviderType.HAI:
      return new HAIProvider(config);

    default:
      throw new Error(`Unsupported provider type: ${config.type}`);
  }
}



