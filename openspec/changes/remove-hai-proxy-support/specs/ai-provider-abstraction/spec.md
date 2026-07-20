## MODIFIED Requirements

### Requirement: AI provider abstraction interface
The system SHALL provide a unified interface for making AI API calls that abstracts away provider-specific implementation details for direct OpenAI and direct Anthropic access.

#### Scenario: Vision API call for OCR
- **WHEN** the system needs to perform OCR on an image using vision capabilities
- **THEN** the abstraction layer SHALL route the request to the configured direct provider (OpenAI or Anthropic) and return normalized text output

#### Scenario: Text completion for summarization
- **WHEN** the system needs to generate a text summary or perform validation
- **THEN** the abstraction layer SHALL route the request to the configured direct provider and return normalized completion text

#### Scenario: Provider selection at runtime
- **WHEN** the system initializes the AI provider
- **THEN** the factory SHALL instantiate either the direct OpenAI provider or the direct Anthropic provider based on configuration

### Requirement: Provider-specific adapters
The system SHALL implement separate adapter classes for direct OpenAI and direct Anthropic API access to handle provider-specific API formats and SDK differences.

#### Scenario: OpenAI adapter with vision
- **WHEN** using OpenAI provider for OCR
- **THEN** the adapter SHALL format requests using OpenAI's vision API message format with base64 images

#### Scenario: Anthropic adapter with vision
- **WHEN** using Anthropic provider for OCR
- **THEN** the adapter SHALL format requests using Anthropic's message API with image content blocks

#### Scenario: Response normalization
- **WHEN** any direct provider returns a response
- **THEN** the adapter SHALL normalize the response to a common format regardless of provider-specific response structure

### Requirement: Error handling and validation
The system SHALL validate direct provider configuration and provide clear error messages when provider setup fails.

#### Scenario: Missing OpenAI credentials
- **WHEN** the selected provider is `openai` and `OPENAI_API_KEY` is not configured
- **THEN** the system SHALL fail immediately with a clear error message indicating that `OPENAI_API_KEY` is required

#### Scenario: Missing Anthropic credentials
- **WHEN** the selected provider is `anthropic` and `ANTHROPIC_API_KEY` is not configured
- **THEN** the system SHALL fail immediately with a clear error message indicating that `ANTHROPIC_API_KEY` is required

#### Scenario: Invalid provider name
- **WHEN** configuration specifies `hai`, `hai-claude`, `hai-openai`, or any other unsupported provider
- **THEN** the system SHALL fail with a migration message that lists the supported values `openai` and `anthropic`

#### Scenario: Invalid model name
- **WHEN** a configured model name is invalid for the selected direct provider
- **THEN** the system SHALL fail with an error listing valid model-name formats for that provider

### Requirement: Backward compatibility
The system SHALL maintain backward compatibility with existing OpenAI-only direct configurations without requiring any changes to user setup.

#### Scenario: Existing OpenAI configuration
- **WHEN** only `OPENAI_API_KEY` is present in environment variables
- **THEN** the system SHALL use OpenAI direct provider with existing model configuration

#### Scenario: Removed HAI configuration
- **WHEN** upgrading from a configuration that used HAI proxy provider values or HAI-specific credentials
- **THEN** the system SHALL fail with migration guidance instead of attempting proxy routing

## REMOVED Requirements

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
