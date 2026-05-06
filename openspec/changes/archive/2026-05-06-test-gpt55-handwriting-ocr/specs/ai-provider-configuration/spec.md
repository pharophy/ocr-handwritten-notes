## MODIFIED Requirements

### Requirement: Model mapping configuration
The system SHALL support mapping operation types (ocr, summarization, validation) to provider-specific model names through environment variables or JSON config, including support for latest OpenAI models (GPT-5, GPT-4.1).

#### Scenario: Environment variable model mapping
- **WHEN** environment variables `AI_MODEL_OCR`, `AI_MODEL_SUMMARIZATION`, `AI_MODEL_VALIDATION` are set
- **THEN** the system SHALL use these model names for the respective operations, including `gpt-5`, `gpt-4.1`, and Claude models if specified

#### Scenario: JSON config model mapping
- **WHEN** `aiProvider.models` object in JSON config specifies model names
- **THEN** the system SHALL use these mappings for operations (e.g., `{"ocr": "gpt-4.1"}` or `{"ocr": "anthropic--claude-4.6-sonnet"}`)

#### Scenario: Default model fallback
- **WHEN** no model mapping is configured for an operation type
- **THEN** the system SHALL use provider-specific defaults (gpt-4.1 for OpenAI OCR based on experiments, claude-4.6-sonnet for Claude OCR)

#### Scenario: Latest OpenAI model selection
- **WHEN** configuration specifies `gpt-5`, `gpt-4.1`, or other latest models as the model for any operation type
- **THEN** the system SHALL use the specified model with appropriate vision capabilities for OCR operations
