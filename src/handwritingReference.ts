import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { createConnection } from 'net';
import { ProviderType, ModelMapping, AIProviderConfig } from './aiProvider';

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
    const buffer = await fs.readFile(resolvedPath);

    // Check file size (warn if > 5MB)
    const sizeInMB = buffer.length / (1024 * 1024);
    if (sizeInMB > 5) {
      console.warn(`⚠️  Reference image is large (${sizeInMB.toFixed(1)}MB). This may increase API costs.`);
    }

    // Validate it's an image by checking file extension
    const ext = path.extname(imagePath).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
      console.warn(`⚠️  Reference image should be .jpg, .jpeg, or .png (found: ${ext})`);
    }

    console.log(`✓ Loaded reference image: ${imagePath} (${sizeInMB.toFixed(2)}MB)`);
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
 * Check if HAI proxy is running on specified port
 */
async function checkHAIProxyRunning(port: number = 6655): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: 'localhost' }, () => {
      socket.end();
      resolve(true);
    });

    socket.on('error', () => {
      resolve(false);
    });

    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Start HAI proxy in headless mode
 */
async function startHAIProxy(): Promise<void> {
  try {
    console.log('🔌 Starting HAI proxy in headless mode...');

    // Start HAI proxy in background
    execSync('hai proxy start --headless &', {
      stdio: 'inherit',
      shell: '/bin/zsh'
    });

    // Wait 2 seconds for proxy to initialize
    execSync('sleep 2', { stdio: 'inherit' });

    // Verify it's running
    const isRunning = await checkHAIProxyRunning();
    if (isRunning) {
      console.log('✅ HAI proxy started successfully');
    } else {
      throw new Error('HAI proxy started but not accepting connections on port 6655');
    }
  } catch (error: any) {
    if (error.message?.includes('command not found') || error.message?.includes('hai')) {
      throw new Error(
        'HAI CLI not found in PATH. Please install it first.\n' +
        'See: https://ai-docs.portal.hyperspace.tools.sap/llm-proxy/recipes/cline/'
      );
    }
    throw error;
  }
}

/**
 * Load AI provider configuration with hierarchy:
 * 1. Environment variables (highest priority)
 * 2. JSON config file
 * 3. Auto-detect HAI proxy
 * 4. Fallback to OpenAI direct
 */
export async function loadAIProviderConfig(
  referenceConfig?: HandwritingReferenceConfig
): Promise<AIProviderConfig> {
  const haiProxyPort = parseInt(process.env.HAI_PROXY_PORT || '6655', 10);

  // 1. Check environment variables
  const envProvider = process.env.AI_PROVIDER as 'openai' | 'hai' | undefined;

  if (envProvider) {
    console.log(`🔧 Using AI provider from environment: ${envProvider}`);

    const config: AIProviderConfig = {
      type: envProvider === 'openai' ? ProviderType.OPENAI : ProviderType.HAI,
      apiKey: getAPIKey(envProvider),
      baseURL: getBaseURL(envProvider),
      models: getModelMapping(envProvider),
      autoStartProxy: getAutoStartProxy(),
    };

    // Handle HAI proxy requirements
    if (envProvider === 'hai') {
      await ensureHAIProxyRunning(config, haiProxyPort);
    }

    logProviderConfig(config);
    return config;
  }

  // 2. Auto-detect: Check if HAI proxy is running
  const haiProxyRunning = await checkHAIProxyRunning(haiProxyPort);
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

  if (haiProxyRunning && !hasOpenAIKey) {
    console.log('🔍 Auto-detected HAI proxy running, using HAI provider');

    const config: AIProviderConfig = {
      type: ProviderType.HAI,
      apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.HAI_API_KEY,
      baseURL: `http://localhost:${haiProxyPort}`,  // Base URL without endpoint
      models: getModelMapping('hai'),
      autoStartProxy: true,
    };

    logProviderConfig(config);
    return config;
  }

  // 3. Fallback to OpenAI direct
  if (!hasOpenAIKey) {
    throw new Error(
      'No AI provider configured. Please either:\n' +
      '1. Set OPENAI_API_KEY environment variable, or\n' +
      '2. Set AI_PROVIDER=hai-claude and ensure HAI proxy is running, or\n' +
      '3. Install HAI CLI and let the system auto-start the proxy'
    );
  }

  console.log('💼 Using OpenAI direct provider (fallback)');

  const config: AIProviderConfig = {
    type: ProviderType.OPENAI,
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: undefined,
    models: getModelMapping('openai'),
    autoStartProxy: false,
  };

  logProviderConfig(config);
  return config;
}

/**
 * Ensure HAI proxy is running, auto-start if needed
 */
async function ensureHAIProxyRunning(config: AIProviderConfig, port: number): Promise<void> {
  const isRunning = await checkHAIProxyRunning(port);

  if (!isRunning) {
    const autoStart = config.autoStartProxy ?? (process.env.HAI_AUTO_START !== 'false');

    if (!autoStart) {
      throw new Error(
        `HAI proxy is not running on port ${port}.\n` +
        'Please start it manually with: hai proxy start'
      );
    }

    // Auto-start HAI proxy
    await startHAIProxy();
  }
}

/**
 * Get API key based on provider type
 */
function getAPIKey(providerType: string): string | undefined {
  if (providerType === 'openai') {
    return process.env.OPENAI_API_KEY;
  }

  if (providerType === 'hai') {
    // HAI proxy uses the same auth token for both OpenAI and Anthropic endpoints
    return process.env.ANTHROPIC_AUTH_TOKEN || process.env.HAI_API_KEY;
  }

  return undefined;
}

/**
 * Get base URL based on provider type
 */
function getBaseURL(providerType: string): string | undefined {
  const haiProxyPort = parseInt(process.env.HAI_PROXY_PORT || '6655', 10);

  if (providerType === 'hai') {
    // Return base proxy URL - HAIProvider will add the correct endpoint
    return `http://localhost:${haiProxyPort}`;
  }

  return undefined; // OpenAI direct uses default
}

/**
 * Get model mapping from environment variables or defaults
 */
function getModelMapping(providerType: string): ModelMapping {
  const envModels: ModelMapping = {
    ocr: process.env.AI_MODEL_OCR,
    summarization: process.env.AI_MODEL_SUMMARIZATION,
    validation: process.env.AI_MODEL_VALIDATION,
    ocrFallback: process.env.AI_MODEL_OCR_FALLBACK,
  };

  // Remove undefined values
  Object.keys(envModels).forEach(key => {
    if (envModels[key as keyof ModelMapping] === undefined) {
      delete envModels[key as keyof ModelMapping];
    }
  });

  // If env vars provided any models, use them
  if (Object.keys(envModels).length > 0) {
    return envModels;
  }

  // Otherwise use provider-specific defaults (will be applied by provider class)
  return {};
}

/**
 * Get auto-start proxy preference
 */
function getAutoStartProxy(): boolean {
  return process.env.HAI_AUTO_START !== 'false';
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

