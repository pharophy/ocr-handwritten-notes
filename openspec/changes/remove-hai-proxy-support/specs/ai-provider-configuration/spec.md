## MODIFIED Requirements

### Requirement: Configuration hierarchy
The system SHALL load AI provider configuration from multiple sources with a defined priority order: environment variables (highest), JSON config file, direct-provider API key inference, and validation failure (lowest).

#### Scenario: Environment variable override
- **WHEN** both environment variables and JSON config specify provider settings
- **THEN** the system SHALL use environment variable values and ignore JSON config

#### Scenario: JSON config as default
- **WHEN** no environment variables are set for provider configuration
- **THEN** the system SHALL load provider settings from `handwriting-reference.json` under the `aiProvider` section

#### Scenario: Direct provider key inference
- **WHEN** no explicit provider configuration exists and exactly one direct provider API key is present
- **THEN** the system SHALL select the matching direct provider (`OPENAI_API_KEY` selects `openai`, `ANTHROPIC_API_KEY` selects `anthropic`)

#### Scenario: Ambiguous direct provider key inference
- **WHEN** no explicit provider configuration exists and both `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are present
- **THEN** the system SHALL fail with a clear message asking the user to set `AI_PROVIDER=openai` or `AI_PROVIDER=anthropic`

#### Scenario: Missing direct provider credentials
- **WHEN** no explicit provider configuration exists and no direct provider API key is present
- **THEN** the system SHALL fail with a clear message explaining that direct OpenAI or Anthropic credentials are required

### Requirement: Provider type selection
The system SHALL support configuration of provider type through `AI_PROVIDER` environment variable or `aiProvider.type` JSON field with values: `openai` or `anthropic`.

#### Scenario: OpenAI direct provider
- **WHEN** `AI_PROVIDER=openai` or `aiProvider.type: "openai"`
- **THEN** the system SHALL use OpenAI SDK with direct API access and require `OPENAI_API_KEY`

#### Scenario: Anthropic direct provider
- **WHEN** `AI_PROVIDER=anthropic` or `aiProvider.type: "anthropic"`
- **THEN** the system SHALL use Anthropic SDK with direct API access and require `ANTHROPIC_API_KEY`

#### Scenario: Removed HAI provider value
- **WHEN** `AI_PROVIDER=hai`, `AI_PROVIDER=hai-claude`, `AI_PROVIDER=hai-openai`, or an equivalent JSON provider type is configured
- **THEN** the system SHALL reject the configuration with migration guidance to use `openai` or `anthropic` directly

### Requirement: Model mapping configuration
The system SHALL support mapping operation types (ocr, summarization, validation, ocr-fallback) to direct provider model names through environment variables or JSON config.

#### Scenario: Environment variable model mapping
- **WHEN** environment variables `AI_MODEL_OCR`, `AI_MODEL_SUMMARIZATION`, `AI_MODEL_VALIDATION`, or `AI_MODEL_OCR_FALLBACK` are set
- **THEN** the system SHALL use these direct provider model names for the respective operations

#### Scenario: JSON config model mapping
- **WHEN** `aiProvider.models` object in JSON config specifies model names
- **THEN** the system SHALL use these mappings for operations (e.g., `{"ocr": "gpt-5-mini"}` for OpenAI or `{"ocr": "claude-sonnet-4-5"}` for Anthropic)

#### Scenario: Default model fallback
- **WHEN** no model mapping is configured for an operation type
- **THEN** the system SHALL use direct provider defaults for OpenAI and Anthropic

#### Scenario: Reject HAI-prefixed Claude model alias
- **WHEN** configuration specifies a Claude model using the HAI proxy alias prefix `anthropic--`
- **THEN** the system SHALL reject the model name with migration guidance to use the direct Anthropic model ID

### Requirement: OpenAI direct configuration
The system SHALL maintain support for existing OpenAI configuration through `OPENAI_API_KEY` and model-specific environment variables.

#### Scenario: OpenAI API key from environment
- **WHEN** `OPENAI_API_KEY` environment variable is set and no provider type is specified
- **THEN** the system SHALL use OpenAI direct provider if no other direct provider key creates ambiguity

#### Scenario: OpenAI model environment variables
- **WHEN** `OPENAI_MODEL_OCR`, `OPENAI_MODEL_SUMMARIZATION`, `OPENAI_MODEL_VALIDATION` are set
- **THEN** the system SHALL use these as OpenAI model overrides for backward compatibility

### Requirement: Anthropic direct configuration
The system SHALL support Anthropic direct configuration through Anthropic connection credentials, optional base URL configuration, and direct Anthropic model names.

#### Scenario: Anthropic API key from environment
- **WHEN** `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` environment variable is set and no provider type is specified
- **THEN** the system SHALL use Anthropic direct provider if no other direct provider key creates ambiguity

#### Scenario: Anthropic auth token from environment
- **WHEN** `ANTHROPIC_AUTH_TOKEN` environment variable is set for the Anthropic provider
- **THEN** the system SHALL use it as the Anthropic API credential

#### Scenario: Anthropic base URL from environment
- **WHEN** `ANTHROPIC_BASE_URL` environment variable is set for the Anthropic provider
- **THEN** the system SHALL use it as the Anthropic SDK base URL

#### Scenario: Anthropic model environment variables
- **WHEN** `AI_MODEL_OCR`, `AI_MODEL_SUMMARIZATION`, or `AI_MODEL_VALIDATION` specify direct Anthropic model names
- **THEN** the system SHALL use those model names with the direct Anthropic API

### Requirement: Configuration validation
The system SHALL validate direct provider configuration at initialization and provide actionable error messages for missing, invalid, or removed settings.

#### Scenario: Validate OpenAI credentials
- **WHEN** provider type is `openai`
- **THEN** the system SHALL verify `OPENAI_API_KEY` is present and fail with a clear error if missing

#### Scenario: Validate Anthropic credentials
- **WHEN** provider type is `anthropic`
- **THEN** the system SHALL verify `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` is present and fail with a clear error if missing

#### Scenario: Validate model name format
- **WHEN** configuration specifies model names
- **THEN** the system SHALL validate format matches direct provider expectations and reject HAI proxy aliases

#### Scenario: Configuration validation failure message
- **WHEN** configuration validation fails
- **THEN** the system SHALL display which configuration is missing, invalid, or removed and suggest direct OpenAI/Anthropic replacements

### Requirement: Configuration logging
The system SHALL log loaded configuration (without sensitive data) to help users troubleshoot direct provider setup issues.

#### Scenario: Log provider type on startup
- **WHEN** the system initializes the AI provider
- **THEN** it SHALL log the selected provider type (`openai` or `anthropic`) and configuration source (env, json, inferred)

#### Scenario: Log model mappings on startup
- **WHEN** the system initializes with specific model mappings
- **THEN** it SHALL log which models will be used for OCR, summarization, validation, and OCR fallback operations

#### Scenario: Redact sensitive data in logs
- **WHEN** logging configuration
- **THEN** the system SHALL redact API keys and other sensitive credentials

## REMOVED Requirements

### Requirement: HAI proxy configuration
The system SHALL support configuration of HAI proxy connection details including HAI API key and port.

#### Scenario: HAI proxy API key from environment
- **WHEN** `HAI_API_KEY` environment variable is set
- **THEN** the system SHALL use this API key for HAI proxy authentication

#### Scenario: HAI proxy API key from keyring
- **WHEN** no API key environment variable exists
- **THEN** the system SHALL attempt to load HAI proxy API key from macOS keyring (where `hai configure claude-code` stores it)

#### Scenario: Custom HAI proxy port
- **WHEN** `HAI_PROXY_PORT` environment variable is set
- **THEN** the system SHALL use this port instead of default 6655

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
