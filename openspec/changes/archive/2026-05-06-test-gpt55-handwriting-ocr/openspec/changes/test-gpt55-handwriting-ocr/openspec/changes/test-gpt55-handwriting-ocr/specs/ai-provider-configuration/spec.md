## MODIFIED Requirements

### Requirement: Model mapping configuration
The system SHALL support mapping operation types (ocr, summarization, validation) to provider-specific model names through environment variables or JSON config, including support for GPT-5.5.

#### Scenario: Environment variable model mapping
- **WHEN** environment variables `AI_MODEL_OCR`, `AI_MODEL_SUMMARIZATION`, `AI_MODEL_VALIDATION` are set
- **THEN** the system SHALL use these model names for the respective operations, including `gpt-5.5` if specified

#### Scenario: JSON config model mapping
- **WHEN** `aiProvider.models` object in JSON config specifies model names
- **THEN** the system SHALL use these mappings for operations (e.g., `{"ocr": "gpt-5.5"}` or `{"ocr": "anthropic--claude-4.5-sonnet"}`)

#### Scenario: Default model fallback
- **WHEN** no model mapping is configured for an operation type
- **THEN** the system SHALL use provider-specific defaults (gpt-4o for OpenAI OCR, claude-4.5-sonnet for Claude OCR)

#### Scenario: GPT-5.5 model selection
- **WHEN** configuration specifies `gpt-5.5` as the model for any operation type
- **THEN** the system SHALL use GPT-5.5 with appropriate vision capabilities for OCR operations
