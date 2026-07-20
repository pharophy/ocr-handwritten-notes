## ADDED Requirements

### Requirement: AI provider abstraction interface
The system SHALL provide a unified interface for direct AI API calls that abstracts provider-specific implementation details for OpenAI and Anthropic.

#### Scenario: Vision API call for OCR
- **WHEN** the system needs to perform OCR on an image using vision capabilities
- **THEN** the abstraction layer SHALL route the request to the configured direct provider and return normalized text output

#### Scenario: Text completion for summarization
- **WHEN** the system needs to generate a text summary or perform validation
- **THEN** the abstraction layer SHALL route the request to the configured direct provider and return normalized completion text

#### Scenario: Provider selection at runtime
- **WHEN** the system initializes the AI provider
- **THEN** the factory SHALL instantiate the configured direct OpenAI or direct Anthropic provider implementation

### Requirement: Provider-specific adapters
The system SHALL implement separate adapter classes for each direct AI provider to handle provider-specific API formats and SDK differences.

#### Scenario: OpenAI adapter with vision
- **WHEN** using OpenAI provider for OCR
- **THEN** the adapter SHALL format requests using OpenAI's vision API message format with base64 images

#### Scenario: Anthropic adapter with vision
- **WHEN** using Anthropic provider for OCR
- **THEN** the adapter SHALL format requests using Anthropic's message API with image content blocks

#### Scenario: Response normalization
- **WHEN** any provider returns a response
- **THEN** the adapter SHALL normalize the response to a common format regardless of provider-specific response structure

### Requirement: Model-specific routing
The system SHALL support different AI models for different operation types to optimize for cost and performance.

#### Scenario: OCR with vision-capable model
- **WHEN** performing OCR operations requiring vision capabilities
- **THEN** the system SHALL use the model configured for OCR operations

#### Scenario: Summarization with configured model
- **WHEN** performing text summarization
- **THEN** the system SHALL use the model configured for summarization

#### Scenario: Validation with configured model
- **WHEN** performing OCR validation
- **THEN** the system SHALL use the model configured for validation

### Requirement: Error handling and validation
The system SHALL validate configuration and provide clear error messages when provider setup fails.

#### Scenario: Missing API credentials
- **WHEN** no valid API key is found for the selected direct provider
- **THEN** the system SHALL fail immediately with a clear error message indicating which credential is missing

#### Scenario: Unsupported provider value
- **WHEN** configuration specifies any provider other than `openai` or `anthropic`
- **THEN** the system SHALL fail with an error listing the supported provider values

#### Scenario: Invalid model name
- **WHEN** a configured model name is invalid for the selected provider
- **THEN** the system SHALL fail with an error explaining the provider-specific model naming requirement

### Requirement: Backward compatibility
The system SHALL maintain backward compatibility with existing OpenAI-only configurations without requiring changes to user setup.

#### Scenario: Existing OpenAI configuration
- **WHEN** only `OPENAI_API_KEY` is present in environment variables
- **THEN** the system SHALL use OpenAI direct provider with existing model configuration
