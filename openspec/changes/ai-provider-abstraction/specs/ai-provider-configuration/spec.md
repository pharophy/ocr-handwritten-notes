## ADDED Requirements

### Requirement: Configuration hierarchy
The system SHALL load AI provider configuration from multiple sources with a defined priority order: environment variables (highest), JSON config file, auto-detection, and fallback defaults (lowest).

#### Scenario: Environment variable override
- **WHEN** both environment variables and JSON config specify provider settings
- **THEN** the system SHALL use environment variable values and ignore JSON config

#### Scenario: JSON config as default
- **WHEN** no environment variables are set for provider configuration
- **THEN** the system SHALL load provider settings from `handwriting-reference.json` under the `aiProvider` section

#### Scenario: Auto-detection of HAI proxy
- **WHEN** no explicit provider configuration exists and HAI proxy is running on port 6655
- **THEN** the system SHALL automatically configure Claude via HAI proxy as the provider

#### Scenario: Fallback to OpenAI direct
- **WHEN** no explicit configuration exists and HAI proxy is not detected
- **THEN** the system SHALL attempt to use OpenAI direct with `OPENAI_API_KEY` from environment

### Requirement: Provider type selection
The system SHALL support configuration of provider type through `AI_PROVIDER` environment variable or `aiProvider.type` JSON field with values: `openai`, `hai-claude`, or `hai-openai`.

#### Scenario: OpenAI direct provider
- **WHEN** `AI_PROVIDER=openai` or `aiProvider.type: "openai"`
- **THEN** the system SHALL use OpenAI SDK with direct API access and require `OPENAI_API_KEY`

#### Scenario: HAI Claude provider
- **WHEN** `AI_PROVIDER=hai-claude` or `aiProvider.type: "hai-claude"`
- **THEN** the system SHALL use Anthropic SDK with HAI proxy base URL and HAI-specific model names

#### Scenario: HAI OpenAI provider
- **WHEN** `AI_PROVIDER=hai-openai` or `aiProvider.type: "hai-openai"`
- **THEN** the system SHALL use OpenAI SDK with HAI proxy base URL and standard OpenAI model names

### Requirement: Model mapping configuration
The system SHALL support mapping operation types (ocr, summarization, validation) to provider-specific model names through environment variables or JSON config.

#### Scenario: Environment variable model mapping
- **WHEN** environment variables `AI_MODEL_OCR`, `AI_MODEL_SUMMARIZATION`, `AI_MODEL_VALIDATION` are set
- **THEN** the system SHALL use these model names for the respective operations

#### Scenario: JSON config model mapping
- **WHEN** `aiProvider.models` object in JSON config specifies model names
- **THEN** the system SHALL use these mappings for operations (e.g., `{"ocr": "anthropic--claude-4.5-sonnet"}`)

#### Scenario: Default model fallback
- **WHEN** no model mapping is configured for an operation type
- **THEN** the system SHALL use provider-specific defaults (gpt-4o for OpenAI OCR, claude-4.5-sonnet for Claude OCR)

### Requirement: HAI proxy configuration
The system SHALL support configuration of HAI proxy connection details including base URL, API key, and port.

#### Scenario: HAI proxy base URL configuration
- **WHEN** `ANTHROPIC_BASE_URL` environment variable is set
- **THEN** the system SHALL use this base URL for Anthropic SDK connections (e.g., `http://localhost:6655/anthropic/`)

#### Scenario: HAI proxy API key from environment
- **WHEN** `ANTHROPIC_AUTH_TOKEN` or `HAI_API_KEY` environment variable is set
- **THEN** the system SHALL use this API key for HAI proxy authentication

#### Scenario: HAI proxy API key from keyring
- **WHEN** no API key environment variable exists
- **THEN** the system SHALL attempt to load HAI proxy API key from macOS keyring (where `hai configure claude-code` stores it)

#### Scenario: Custom HAI proxy port
- **WHEN** `HAI_PROXY_PORT` environment variable is set
- **THEN** the system SHALL use this port instead of default 6655

### Requirement: OpenAI direct configuration
The system SHALL maintain support for existing OpenAI configuration through `OPENAI_API_KEY` and model-specific environment variables.

#### Scenario: OpenAI API key from environment
- **WHEN** `OPENAI_API_KEY` environment variable is set and no provider type is specified
- **THEN** the system SHALL use OpenAI direct provider with this API key

#### Scenario: OpenAI model environment variables
- **WHEN** `OPENAI_MODEL_OCR`, `OPENAI_MODEL_SUMMARIZATION`, `OPENAI_MODEL_VALIDATION` are set
- **THEN** the system SHALL use these as model overrides for backward compatibility

### Requirement: Configuration validation
The system SHALL validate configuration at initialization and provide actionable error messages for missing or invalid settings.

#### Scenario: Validate required credentials
- **WHEN** provider type requires an API key (OpenAI direct)
- **THEN** the system SHALL verify the API key is present and fail with clear error if missing

#### Scenario: Validate HAI proxy accessibility
- **WHEN** provider type uses HAI proxy
- **THEN** the system SHALL check if port 6655 is accessible and attempt to auto-start HAI proxy if not running

#### Scenario: Validate model name format
- **WHEN** configuration specifies model names
- **THEN** the system SHALL validate format matches provider expectations (e.g., HAI requires `anthropic--` prefix)

#### Scenario: Configuration validation failure message
- **WHEN** configuration validation fails
- **THEN** the system SHALL display which configuration is missing or invalid and suggest fixes (e.g., "Set OPENAI_API_KEY or start HAI proxy with 'hai proxy start'")

### Requirement: Configuration logging
The system SHALL log loaded configuration (without sensitive data) to help users troubleshoot provider setup issues.

#### Scenario: Log provider type on startup
- **WHEN** the system initializes the AI provider
- **THEN** it SHALL log the selected provider type (openai, hai-claude, hai-openai) and configuration source (env, json, auto-detect, fallback)

#### Scenario: Log model mappings on startup
- **WHEN** the system initializes with specific model mappings
- **THEN** it SHALL log which models will be used for OCR, summarization, and validation operations

#### Scenario: Redact sensitive data in logs
- **WHEN** logging configuration
- **THEN** the system SHALL redact API keys (show only first 8 characters) and other sensitive credentials

### Requirement: HAI proxy auto-start
The system SHALL automatically start HAI proxy when needed, controlled by configuration or environment variable.

#### Scenario: Auto-start enabled by default
- **WHEN** provider type uses HAI proxy and HAI proxy is not running
- **THEN** the system SHALL attempt to start HAI proxy in headless mode using `execSync('hai proxy start --headless &', { stdio: 'inherit', shell: '/bin/zsh' })`

#### Scenario: Auto-start disabled via environment variable
- **WHEN** `HAI_AUTO_START=false` environment variable is set and HAI proxy is not running
- **THEN** the system SHALL fail with error message instructing user to manually run `hai proxy start`

#### Scenario: Auto-start disabled via JSON config
- **WHEN** `aiProvider.autoStartProxy: false` in JSON config and HAI proxy is not running
- **THEN** the system SHALL fail with error message instructing user to manually run `hai proxy start`

#### Scenario: Auto-start success with wait period
- **WHEN** HAI proxy is successfully started in background
- **THEN** the system SHALL wait 2 seconds for proxy to initialize before attempting to connect

#### Scenario: Auto-start failure
- **WHEN** HAI proxy auto-start command fails
- **THEN** the system SHALL fail with error message including the caught error and troubleshooting steps

#### Scenario: HAI CLI not installed
- **WHEN** HAI proxy needs to be started but `hai` command is not found in PATH
- **THEN** the system SHALL fail with error message: "Make sure the 'hai' command is available in your PATH. See: https://ai-docs.portal.hyperspace.tools.sap/llm-proxy/recipes/cline/"

#### Scenario: Verify proxy running after start
- **WHEN** HAI proxy auto-start completes successfully
- **THEN** the system SHALL verify port 6655 is accepting connections before proceeding with provider initialization
