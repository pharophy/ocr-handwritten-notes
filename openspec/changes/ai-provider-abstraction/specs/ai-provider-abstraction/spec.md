## ADDED Requirements

### Requirement: AI provider abstraction interface
The system SHALL provide a unified interface for making AI API calls that abstracts away provider-specific implementation details (OpenAI vs Claude).

#### Scenario: Vision API call for OCR
- **WHEN** the system needs to perform OCR on an image using vision capabilities
- **THEN** the abstraction layer SHALL route the request to the configured provider (OpenAI or Claude) and return normalized text output

#### Scenario: Text completion for summarization
- **WHEN** the system needs to generate a text summary or perform validation
- **THEN** the abstraction layer SHALL route the request to the configured provider and return normalized completion text

#### Scenario: Provider selection at runtime
- **WHEN** the system initializes the AI provider
- **THEN** the factory SHALL instantiate the correct provider implementation based on configuration (OpenAI direct, Claude via HAI, or OpenAI via HAI)

### Requirement: Provider-specific adapters
The system SHALL implement separate adapter classes for each AI provider to handle provider-specific API formats and SDK differences.

#### Scenario: OpenAI adapter with vision
- **WHEN** using OpenAI provider for OCR
- **THEN** the adapter SHALL format requests using OpenAI's vision API message format with base64 images

#### Scenario: Claude adapter with vision
- **WHEN** using Claude provider for OCR
- **THEN** the adapter SHALL format requests using Anthropic's message API with image content blocks

#### Scenario: Response normalization
- **WHEN** any provider returns a response
- **THEN** the adapter SHALL normalize the response to a common format regardless of provider-specific response structure

### Requirement: HAI proxy support
The system SHALL support routing requests through SAP's HAI proxy running on localhost:6655 for both OpenAI and Claude providers.

#### Scenario: HAI proxy with Claude
- **WHEN** configured to use Claude via HAI proxy
- **THEN** the system SHALL use base URL `http://localhost:6655/anthropic/` with HAI-specific model naming (e.g., `anthropic--claude-4.5-sonnet`)

#### Scenario: HAI proxy with OpenAI
- **WHEN** configured to use OpenAI via HAI proxy
- **THEN** the system SHALL use base URL `http://localhost:6655/openai/v1` with standard OpenAI model names

#### Scenario: HAI proxy authentication
- **WHEN** connecting to HAI proxy
- **THEN** the system SHALL use the API key from HAI proxy configuration (stored in keyring or provided in config)

### Requirement: Model-specific routing
The system SHALL support different AI models for different operation types (OCR, summarization, validation) to optimize for cost and performance.

#### Scenario: OCR with high-capability model
- **WHEN** performing OCR operations requiring vision capabilities
- **THEN** the system SHALL use the model configured for OCR operations (e.g., gpt-4o or claude-4.5-sonnet)

#### Scenario: Summarization with efficient model
- **WHEN** performing text summarization
- **THEN** the system SHALL use the model configured for summarization (e.g., gpt-4o-mini or claude-4.5-haiku)

#### Scenario: Validation with efficient model
- **WHEN** performing OCR validation
- **THEN** the system SHALL use the model configured for validation (e.g., gpt-4o-mini or claude-4.5-haiku)

### Requirement: Error handling and validation
The system SHALL validate configuration and provide clear error messages when provider setup fails.

#### Scenario: Missing API credentials
- **WHEN** no valid API key or HAI proxy configuration is found
- **THEN** the system SHALL fail immediately with a clear error message indicating which configuration is missing

#### Scenario: HAI proxy not running
- **WHEN** configured to use HAI proxy but port 6655 is not accessible
- **THEN** the system SHALL provide an error message with instructions to start HAI proxy using `hai proxy start`

#### Scenario: Invalid model name
- **WHEN** a configured model name is invalid for the selected provider
- **THEN** the system SHALL fail with an error listing valid model names for that provider

### Requirement: Backward compatibility
The system SHALL maintain backward compatibility with existing OpenAI-only configurations without requiring any changes to user setup.

#### Scenario: Existing OpenAI configuration
- **WHEN** only `OPENAI_API_KEY` is present in environment variables
- **THEN** the system SHALL use OpenAI direct provider with existing model configuration

#### Scenario: No configuration migration required
- **WHEN** upgrading from a previous version with OpenAI configuration
- **THEN** the system SHALL continue working without requiring any .env or config file changes
