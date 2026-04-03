## MODIFIED Requirements

### Requirement: Model mapping configuration
The system SHALL support mapping operation types (ocr, summarization, validation, ocr-fallback) to provider-specific model names through environment variables or JSON config.

#### Scenario: Environment variable model mapping
- **WHEN** environment variables `AI_MODEL_OCR`, `AI_MODEL_SUMMARIZATION`, `AI_MODEL_VALIDATION`, `AI_MODEL_OCR_FALLBACK` are set
- **THEN** the system SHALL use these model names for the respective operations

#### Scenario: JSON config model mapping
- **WHEN** `aiProvider.models` object in JSON config specifies model names
- **THEN** the system SHALL use these mappings for operations (e.g., `{"ocr": "anthropic--claude-4.6-sonnet", "ocrFallback": "gpt-4.1-mini"}`)

#### Scenario: Default model fallback
- **WHEN** no model mapping is configured for an operation type
- **THEN** the system SHALL use provider-specific defaults (gpt-4o for OpenAI OCR, claude-4.6-sonnet for Claude OCR, gpt-4.1-mini for OCR fallback)

#### Scenario: Fallback model disabled
- **WHEN** `AI_MODEL_OCR_FALLBACK` is set to empty string or "none"
- **THEN** the system SHALL not configure a fallback model

### Requirement: Configuration logging
The system SHALL log loaded configuration (without sensitive data) to help users troubleshoot provider setup issues, including fallback model configuration.

#### Scenario: Log provider type on startup
- **WHEN** the system initializes the AI provider
- **THEN** it SHALL log the selected provider type (openai, hai-claude, hai-openai) and configuration source (env, json, auto-detect, fallback)

#### Scenario: Log model mappings on startup
- **WHEN** the system initializes with specific model mappings
- **THEN** it SHALL log which models will be used for OCR, summarization, validation, and OCR fallback operations

#### Scenario: Redact sensitive data in logs
- **WHEN** logging configuration
- **THEN** the system SHALL redact API keys (show only first 8 characters) and other sensitive credentials
