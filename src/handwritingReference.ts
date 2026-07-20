import fs from 'fs/promises';
import path from 'path';
import { ProviderType, ModelMapping, AIProviderConfig, isAnthropic, isOpenAI } from './aiProvider';
import { compressImageIfNeeded, getCompressionConfig, BYTES_PER_MB, SIZE_DECIMAL_PLACES } from './ocr';

export interface DomainGlossary {
  acronyms?: Record<string, string>;
  properNouns?: string[];
  businessTerms?: string[];
  specialNotation?: {
    arrow?: string;
    description?: string;
  };
}

export interface HandwritingReferenceConfig {
  referenceWords?: string[];
  specialCharacters?: string[];
  referenceImagePath?: string;
  notes?: string;
  domainGlossary?: DomainGlossary;
  ocrValidation?: {
    enabled?: boolean;
    confidenceThreshold?: number;
    skipSummarizationThreshold?: number;
    appendReportOnIssues?: boolean;
  };
  ocrCorrection?: {
    enabled?: boolean;
    correctCriticalOnly?: boolean;
    tagCorrections?: boolean;
    maxCorrectionsPerImage?: number;
    minIssueConfidence?: number;
  };
}

const DEFAULT_CONFIG_PATH = path.resolve(
  process.cwd(),
  process.env.HANDWRITING_REFERENCE_FILE || 'handwriting-reference.json'
);

const isEnabled = () => {
  const enabled = process.env.HANDWRITING_REFERENCE_ENABLED;
  return enabled === undefined || enabled === 'true';
};

/**
 * Load handwriting reference configuration from JSON file
 * Returns empty config if file doesn't exist or has errors
 */
export async function loadHandwritingReference(
  configPath: string = DEFAULT_CONFIG_PATH
): Promise<HandwritingReferenceConfig> {
  // Check if feature is enabled via environment variable
  if (!isEnabled()) {
    console.log('ℹ️  Handwriting reference disabled via environment variable');
    return {};
  }

  try {
    const fileContent = await fs.readFile(configPath, 'utf-8');
    const config: HandwritingReferenceConfig = JSON.parse(fileContent);

    // Validate structure
    if (typeof config !== 'object' || config === null) {
      console.warn('⚠️  Invalid handwriting reference config structure, using defaults');
      return {};
    }

    console.log('✓ Loaded handwriting reference configuration');
    return config;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('ℹ️  No handwriting reference found (optional)');
    } else if (error instanceof SyntaxError) {
      console.warn('⚠️  Invalid JSON in handwriting reference file:', error.message);
    } else {
      console.warn('⚠️  Error loading handwriting reference:', error.message);
    }
    return {};
  }
}

/**
 * Load reference image if path is specified in config
 * Returns null if image doesn't exist or can't be loaded
 */
export async function loadReferenceImage(
  imagePath: string
): Promise<Buffer | null> {
  try {
    const resolvedPath = path.resolve(process.cwd(), imagePath);
    let buffer = await fs.readFile(resolvedPath);

    const originalSizeInMB = buffer.length / BYTES_PER_MB;

    // Validate it's an image by checking file extension
    const ext = path.extname(imagePath).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
      console.warn(`⚠️  Reference image should be .jpg, .jpeg, or .png (found: ${ext})`);
    }

    // Compress image if needed (for images >5MB)
    const compressionConfig = getCompressionConfig();
    if (compressionConfig.enabled && buffer.length > compressionConfig.maxSizeBytes) {
      console.log(`📦 Compressing reference image: ${imagePath} (${originalSizeInMB.toFixed(SIZE_DECIMAL_PLACES)}MB)`);
      const compressionResult = await compressImageIfNeeded(
        buffer,
        compressionConfig.maxSizeBytes,
        compressionConfig.minQuality
      );
      buffer = compressionResult.buffer;
    } else {
      console.log(`✓ Loaded reference image: ${imagePath} (${originalSizeInMB.toFixed(SIZE_DECIMAL_PLACES)}MB)`);
    }

    return buffer;
  } catch (error: any) {
    console.warn(`⚠️  Could not load reference image at ${imagePath}:`, error.message);
    return null;
  }
}

/**
 * Format reference words into a prompt-friendly string for the system prompt
 */
export function formatReferenceWordsForPrompt(config: HandwritingReferenceConfig): string {
  if (!config.referenceWords || config.referenceWords.length === 0) {
    return '';
  }

  const sections: string[] = [];

  sections.push('🖊️ Handwriting Reference Key:');
  sections.push('You are transcribing notes written by a specific individual. To improve accuracy, here are reference words showing how this person writes different letters:');
  sections.push('');

  // Group reference words by type
  const uppercase = config.referenceWords.filter(w => /^[A-Z]+$/.test(w));
  const lowercase = config.referenceWords.filter(w => /^[a-z]+$/.test(w));
  const numbers = config.referenceWords.filter(w => /^[0-9]+$/.test(w));
  const mixed = config.referenceWords.filter(w =>
    !/^[A-Z]+$/.test(w) && !/^[a-z]+$/.test(w) && !/^[0-9]+$/.test(w)
  );

  if (uppercase.length > 0) {
    sections.push(`Uppercase reference: ${uppercase.join(', ')}`);
  }
  if (lowercase.length > 0) {
    sections.push(`Lowercase reference: ${lowercase.join(', ')}`);
  }
  if (numbers.length > 0) {
    sections.push(`Numbers reference: ${numbers.join(', ')}`);
  }
  if (mixed.length > 0) {
    sections.push(`Mixed case examples: ${mixed.join(', ')}`);
  }

  if (config.specialCharacters && config.specialCharacters.length > 0) {
    sections.push(`Special characters: ${config.specialCharacters.join(' ')}`);
  }

  sections.push('');
  sections.push('When you see similar letter formations in the target image, use these reference words to disambiguate unclear characters. For example:');
  sections.push('- If an uppercase letter is unclear, check how it appears in the uppercase reference above');
  sections.push('- If a lowercase letter is ambiguous, reference the lowercase examples');
  sections.push('- Compare commonly confused letters (l/I/1, a/o, u/v, m/n) against the references');
  sections.push('');
  sections.push('Apply this character-level understanding to maximize transcription accuracy.');

  return sections.join('\n');
}

/**
 * Format reference image instructions for the prompt
 */
export function formatReferenceImageInstructions(): string {
  return `
🖊️ Handwriting Reference Image:
You are transcribing notes written by a specific individual. A reference image has been provided (shown first) demonstrating how this person writes different letters, numbers, and words in their natural handwriting.

When transcribing the target image (shown second):
1. Compare unclear characters to the reference image
2. Match letter formations between the target and reference
3. Use consistent interpretation of this person's unique writing style
4. Pay special attention to commonly confused letters (l/I/1, a/o, u/v, m/n, etc.)
5. Notice if certain letters look different in different contexts in their handwriting

The reference image shows examples of the alphabet, common words, and numbers in this person's handwriting. Use it as a visual guide for character recognition.
`;
}

/**
 * Check if reference image path exists
 */
export async function referenceImageExists(imagePath: string): Promise<boolean> {
  try {
    const resolvedPath = path.resolve(process.cwd(), imagePath);
    await fs.access(resolvedPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get domain glossary from configuration
 */
export function getDomainGlossary(config: HandwritingReferenceConfig): DomainGlossary {
  return config.domainGlossary || {};
}

/**
 * Format domain glossary into a prompt-friendly string for the system prompt
 */
export function formatGlossaryContext(glossary: DomainGlossary): string {
  if (!glossary || Object.keys(glossary).length === 0) {
    return '';
  }

  const sections: string[] = [];
  sections.push('');
  sections.push('📋 Business & Technical Context:');
  sections.push('You are transcribing meeting notes that frequently contain specialized terminology:');
  sections.push('');

  if (glossary.acronyms && Object.keys(glossary.acronyms).length > 0) {
    sections.push('Common Acronyms (preserve these EXACTLY as written in all caps):');
    for (const [acronym, description] of Object.entries(glossary.acronyms)) {
      sections.push(`- ${acronym}: ${description}`);
    }
    sections.push('');
  }

  if (glossary.properNouns && glossary.properNouns.length > 0) {
    sections.push('Expected Proper Nouns:');
    sections.push(glossary.properNouns.join(', '));
    sections.push('');
  }

  if (glossary.businessTerms && glossary.businessTerms.length > 0) {
    sections.push('Common Business Terms:');
    sections.push(glossary.businessTerms.join(', '));
    sections.push('');
  }

  if (glossary.specialNotation) {
    sections.push('Special Notation:');
    if (glossary.specialNotation.arrow) {
      sections.push(`- Arrows: Use "${glossary.specialNotation.arrow}" for arrow symbols`);
    }
    if (glossary.specialNotation.description) {
      sections.push(`- ${glossary.specialNotation.description}`);
    }
    sections.push('');
  }

  sections.push('⚠️ Uncertainty Guidelines:');
  sections.push('- If you see text that MIGHT be one of the above acronyms but you\'re unsure, transcribe what you see and mark it with *italics*');
  sections.push('- If a word is completely illegible, mark it as *[illegible]*');
  sections.push('- If you see arrows or special notation, preserve them exactly (use →)');
  sections.push('- When you see an acronym in all caps, keep it in all caps');
  sections.push('- If a phrase doesn\'t make grammatical sense, mark questionable words with *italics*');
  sections.push('');

  return sections.join('\n');
}

// ============================================================================
// AI Provider Configuration
// ============================================================================

/**
 * Load AI provider configuration with hierarchy:
 * 1. Environment variables
 * 2. JSON config file (reserved for future structured provider settings)
 * 3. Direct provider API key inference
 * 4. Validation error
 */
export async function loadAIProviderConfig(
  referenceConfig?: HandwritingReferenceConfig
): Promise<AIProviderConfig> {
  void referenceConfig;

  const envProvider = process.env.AI_PROVIDER;

  if (envProvider) {
    const type = parseProviderType(envProvider);
    console.log(`Using AI provider from environment: ${type}`);

    const config: AIProviderConfig = {
      type,
      apiKey: getAPIKey(type),
      baseURL: getBaseURL(type),
      models: getModelMapping(type),
    };

    logProviderConfig(config);
    return config;
  }

  const hasOpenAIKey = hasConfiguredCredential(process.env.OPENAI_API_KEY);
  const hasAnthropicKey = hasConfiguredCredential(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

  if (hasOpenAIKey && hasAnthropicKey) {
    throw new Error(
      'Both OpenAI and Anthropic credentials are configured.\n' +
      'Set AI_PROVIDER=openai or AI_PROVIDER=anthropic to choose one.'
    );
  }

  if (!hasOpenAIKey && !hasAnthropicKey) {
    throw new Error(
      'No AI provider configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or ANTHROPIC_AUTH_TOKEN.\n' +
      'Use AI_PROVIDER=openai or AI_PROVIDER=anthropic to select a provider explicitly.'
    );
  }

  const inferredType = hasAnthropicKey ? ProviderType.ANTHROPIC : ProviderType.OPENAI;
  console.log(`Using ${inferredType} provider inferred from credentials`);

  const config: AIProviderConfig = {
    type: inferredType,
    apiKey: getAPIKey(inferredType),
    baseURL: getBaseURL(inferredType),
    models: getModelMapping(inferredType),
  };

  logProviderConfig(config);
  return config;
}

function parseProviderType(providerType: string): ProviderType {
  if (providerType === ProviderType.OPENAI) {
    return ProviderType.OPENAI;
  }

  if (providerType === ProviderType.ANTHROPIC) {
    return ProviderType.ANTHROPIC;
  }

  throw new Error(
    `Unsupported AI_PROVIDER value: ${providerType}.\n` +
    'Supported values: openai, anthropic.'
  );
}

function getAPIKey(providerType: ProviderType): string | undefined {
  if (providerType === ProviderType.OPENAI) {
    return getConfiguredCredential('OPENAI_API_KEY', process.env.OPENAI_API_KEY);
  }

  if (providerType === ProviderType.ANTHROPIC) {
    return getConfiguredCredential(
      process.env.ANTHROPIC_API_KEY ? 'ANTHROPIC_API_KEY' : 'ANTHROPIC_AUTH_TOKEN',
      process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN
    );
  }

  return undefined;
}

function getBaseURL(providerType: ProviderType): string | undefined {
  if (providerType === ProviderType.ANTHROPIC) {
    return process.env.ANTHROPIC_BASE_URL;
  }

  return undefined;
}

function getModelMapping(providerType: ProviderType): ModelMapping {
  const envModels: ModelMapping = {
    ocr: process.env.AI_MODEL_OCR,
    summarization: process.env.AI_MODEL_SUMMARIZATION,
    validation: process.env.AI_MODEL_VALIDATION,
    ocrFallback: process.env.AI_MODEL_OCR_FALLBACK,
  };

  if (providerType === ProviderType.OPENAI) {
    envModels.ocr ||= process.env.OPENAI_MODEL_OCR;
    envModels.summarization ||= process.env.OPENAI_MODEL_SUMMARIZATION;
    envModels.validation ||= process.env.OPENAI_MODEL_VALIDATION;
  }

  // Remove undefined values
  Object.keys(envModels).forEach(key => {
    if (envModels[key as keyof ModelMapping] === undefined) {
      delete envModels[key as keyof ModelMapping];
    }
  });

  // If env vars provided any models, use them
  if (Object.keys(envModels).length > 0) {
    validateModelMapping(providerType, envModels);
    return envModels;
  }

  // Otherwise use provider-specific defaults (will be applied by provider class)
  return {};
}

function hasConfiguredCredential(value: string | undefined): boolean {
  return Boolean(value && !isPlaceholderCredential(value));
}

function getConfiguredCredential(name: string, value: string | undefined): string | undefined {
  if (value && isPlaceholderCredential(value)) {
    throw new Error(
      `${name} is still set to a placeholder value. Replace it with a real credential or leave it unset.`
    );
  }

  return value;
}

function isPlaceholderCredential(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === '' ||
    normalized.includes('your_') ||
    normalized.includes('placeholder') ||
    normalized.includes('example') ||
    normalized.endsWith('_here') ||
    normalized === 'sk-proj-...'
  );
}

function validateModelMapping(providerType: ProviderType, models: ModelMapping): void {
  for (const [key, model] of Object.entries(models)) {
    if (!model || model === 'none') {
      continue;
    }

    if (model.startsWith('anthropic--')) {
      throw new Error(
        `Invalid ${key} model "${model}". Use a direct Anthropic model ID instead of a legacy prefixed Claude alias.`
      );
    }

    if (providerType === ProviderType.OPENAI && !isOpenAI(model)) {
      throw new Error(`Invalid ${key} model "${model}" for OpenAI provider. Use an OpenAI model ID.`);
    }

    if (providerType === ProviderType.ANTHROPIC && !isAnthropic(model)) {
      throw new Error(`Invalid ${key} model "${model}" for Anthropic provider. Use an Anthropic model ID.`);
    }
  }
}

/**
 * Log provider configuration (with sensitive data redacted)
 */
function logProviderConfig(config: AIProviderConfig): void {
  console.log('\n📋 AI Provider Configuration:');
  console.log(`  Provider: ${config.type}`);
  console.log(`  API Key: ${config.apiKey ? config.apiKey.substring(0, 8) + '...' : 'not set'}`);
  console.log(`  Base URL: ${config.baseURL || 'default'}`);

  if (config.models && Object.keys(config.models).length > 0) {
    console.log('  Models:');
    if (config.models.ocr) console.log(`    OCR: ${config.models.ocr}`);
    if (config.models.summarization) console.log(`    Summarization: ${config.models.summarization}`);
    if (config.models.validation) console.log(`    Validation: ${config.models.validation}`);
    if (config.models.ocrFallback) console.log(`    OCR Fallback: ${config.models.ocrFallback}`);
  }
  console.log('');
}
