## ADDED Requirements

### Requirement: Configuration hierarchy
The system SHALL load AI provider configuration from environment variables first, then supported JSON config fields, then safe defaults.

#### Scenario: Environment variable override
- **WHEN** both environment variables and JSON config specify provider settings
- **THEN** the system SHALL use environment variable values and ignore JSON config

#### Scenario: JSON config as default
- **WHEN** no environment variables are set for provider configuration
- **THEN** the system SHALL load supported provider settings from `handwriting-reference.json` under the `aiProvider` section

#### Scenario: Infer OpenAI direct provider
- **WHEN** no explicit provider is configured and only `OPENAI_API_KEY` is present
- **THEN** the system SHALL use OpenAI direct provider

#### Scenario: Infer Anthropic direct provider
- **WHEN** no explicit provider is configured and only Anthropic credentials are present
- **THEN** the system SHALL use Anthropic direct provider

#### Scenario: Ambiguous provider credentials
- **WHEN** both OpenAI and Anthropic credentials exist without explicit provider selection
- **THEN** the system SHALL fail with a message requiring `AI_PROVIDER`

### Requirement: Provider type selection
The system SHALL support provider type selection through `AI_PROVIDER` environment variable or `aiProvider.type` JSON field with values `openai` or `anthropic`.

#### Scenario: OpenAI direct provider
- **WHEN** `AI_PROVIDER=openai` or `aiProvider.type: "openai"`
- **THEN** the system SHALL use OpenAI SDK with direct API access and require `OPENAI_API_KEY`

#### Scenario: Anthropic direct provider
- **WHEN** `AI_PROVIDER=anthropic` or `aiProvider.type: "anthropic"`
- **THEN** the system SHALL use Anthropic SDK with direct API access and require `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`

#### Scenario: Unsupported provider value
- **WHEN** provider configuration specifies any other value
- **THEN** the system SHALL reject the configuration and list supported values

### Requirement: Model mapping configuration
The system SHALL support mapping operation types to provider-native model names through environment variables or JSON config.

#### Scenario: Environment variable model mapping
- **WHEN** environment variables `AI_MODEL_OCR`, `AI_MODEL_OCR_FALLBACK`, `AI_MODEL_SUMMARIZATION`, or `AI_MODEL_VALIDATION` are set
- **THEN** the system SHALL use these model names for the respective operations

#### Scenario: JSON config model mapping
- **WHEN** `aiProvider.models` object in JSON config specifies model names
- **THEN** the system SHALL use these mappings for operations

#### Scenario: Legacy prefixed Anthropic alias
- **WHEN** an Anthropic model name uses a removed prefixed alias format
- **THEN** the system SHALL reject the configuration and ask for a provider-native Anthropic model ID

### Requirement: OpenAI direct configuration
The system SHALL support OpenAI direct configuration through `OPENAI_API_KEY` and model-specific environment variables.

#### Scenario: OpenAI API key from environment
- **WHEN** `OPENAI_API_KEY` environment variable is set and OpenAI provider is selected
- **THEN** the system SHALL use OpenAI direct provider with this API key

#### Scenario: OpenAI model environment variables
- **WHEN** `OPENAI_MODEL_OCR`, `OPENAI_MODEL_SUMMARIZATION`, or `OPENAI_MODEL_VALIDATION` are set
- **THEN** the system SHALL use these as OpenAI model overrides for backward compatibility

### Requirement: Anthropic direct configuration
The system SHALL support Anthropic direct configuration through Anthropic credentials and optional endpoint override.

#### Scenario: Anthropic API key from environment
- **WHEN** `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` environment variable is set and Anthropic provider is selected
- **THEN** the system SHALL use Anthropic direct provider with this credential

#### Scenario: Anthropic endpoint override
- **WHEN** `ANTHROPIC_BASE_URL` environment variable is set and Anthropic provider is selected
- **THEN** the system SHALL use that endpoint for Anthropic SDK connections

### Requirement: Configuration validation
The system SHALL validate configuration at initialization and provide actionable error messages for missing or invalid settings.

#### Scenario: Validate required OpenAI credentials
- **WHEN** OpenAI provider is selected
- **THEN** the system SHALL verify `OPENAI_API_KEY` is present and fail with a clear error if missing

#### Scenario: Validate required Anthropic credentials
- **WHEN** Anthropic provider is selected
- **THEN** the system SHALL verify `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` is present and fail with a clear error if missing

#### Scenario: Configuration validation failure message
- **WHEN** configuration validation fails
- **THEN** the system SHALL display which configuration is missing or invalid and suggest direct-provider fixes

### Requirement: Configuration logging
The system SHALL log loaded configuration without sensitive data to help users troubleshoot provider setup issues.

#### Scenario: Log provider type on startup
- **WHEN** the system initializes the AI provider
- **THEN** it SHALL log the selected provider type and configuration source

#### Scenario: Log model mappings on startup
- **WHEN** the system initializes with specific model mappings
- **THEN** it SHALL log which models will be used for OCR, summarization, validation, and fallback operations

#### Scenario: Redact sensitive data in logs
- **WHEN** logging configuration
- **THEN** the system SHALL redact API keys and other sensitive credentials
