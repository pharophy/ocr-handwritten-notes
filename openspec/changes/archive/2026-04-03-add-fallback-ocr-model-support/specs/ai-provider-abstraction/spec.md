## MODIFIED Requirements

### Requirement: AI provider abstraction interface
The system SHALL provide a unified interface for making AI API calls that abstracts away provider-specific implementation details.

#### Scenario: Vision API call for OCR
- **WHEN** the system needs to perform OCR on an image using vision capabilities
- **THEN** the abstraction layer SHALL route the request to the configured provider and return normalized response with content and model identifier

#### Scenario: Text completion for summarization
- **WHEN** the system needs to generate a text summary or perform validation
- **THEN** the abstraction layer SHALL route the request to the configured provider and return normalized completion text

#### Scenario: Provider selection at runtime
- **WHEN** the system initializes the AI provider
- **THEN** the factory SHALL instantiate the correct provider implementation based on configuration (OpenAI direct or HAI proxy)

### Requirement: Provider-specific adapters
The system SHALL implement adapter classes for each provider integration pattern to handle provider-specific API formats.

#### Scenario: OpenAI direct adapter
- **WHEN** using OpenAI provider directly
- **THEN** the adapter SHALL format requests using OpenAI's API with standard model names

#### Scenario: HAI proxy adapter with dynamic routing
- **WHEN** using HAI proxy provider
- **THEN** the adapter SHALL dynamically route to correct endpoint based on model name prefix (anthropic--* → /anthropic/, gpt-* → /openai/v1)

#### Scenario: Response normalization
- **WHEN** any provider returns a response
- **THEN** the adapter SHALL normalize the response to a common format with content and model identifier

### Requirement: HAI proxy support
The system SHALL support routing requests through HAI proxy with automatic endpoint selection based on model name.

#### Scenario: HAI proxy with Claude model
- **WHEN** model name starts with 'anthropic--'
- **THEN** the system SHALL route to `http://localhost:{port}/anthropic/` endpoint

#### Scenario: HAI proxy with OpenAI model
- **WHEN** model name starts with 'gpt-'
- **THEN** the system SHALL route to `http://localhost:{port}/openai/v1` endpoint

#### Scenario: HAI proxy authentication
- **WHEN** connecting to HAI proxy
- **THEN** the system SHALL use the API key from HAI proxy configuration

## REMOVED Requirements

### Requirement: Provider selection at runtime
**Reason**: Simplified from three provider types (openai, hai-claude, hai-openai) to two (openai, hai)
**Migration**: Use provider type 'hai' for all HAI proxy usage. Model-based routing handles Claude vs OpenAI automatically.

## ADDED Requirements

### Requirement: Simplified provider type configuration
The system SHALL support only two provider types: 'openai' for direct OpenAI access and 'hai' for HAI proxy with automatic model-based routing.

#### Scenario: OpenAI direct provider
- **WHEN** AI_PROVIDER is set to 'openai'
- **THEN** the system SHALL use OpenAI SDK directly with OpenAI API key and models

#### Scenario: HAI unified provider
- **WHEN** AI_PROVIDER is set to 'hai'
- **THEN** the system SHALL use HAI proxy with automatic endpoint routing based on model name prefix

#### Scenario: Backward compatibility
- **WHEN** legacy configuration uses provider type names
- **THEN** the system SHALL map to simplified types or provide clear migration error

### Requirement: Model-based endpoint routing
The system SHALL automatically determine the correct HAI proxy endpoint based on the model name being used.

#### Scenario: Claude model routing
- **WHEN** a model name starts with 'anthropic--' (e.g., anthropic--claude-4.6-sonnet)
- **THEN** the HAI provider SHALL use the /anthropic/ endpoint

#### Scenario: OpenAI model routing
- **WHEN** a model name starts with 'gpt-' (e.g., gpt-4.1-mini)
- **THEN** the HAI provider SHALL use the /openai/v1 endpoint

#### Scenario: Unknown model prefix
- **WHEN** a model name doesn't match known prefixes
- **THEN** the system SHALL default to /openai/v1 endpoint

### Requirement: Dynamic provider instantiation for fallback
The system SHALL support creating new provider instances with different configurations for fallback scenarios.

#### Scenario: Provider config copying
- **WHEN** creating a fallback provider
- **THEN** the system SHALL copy the current provider's configuration and modify only necessary fields (type, baseURL, model)

#### Scenario: Cross-provider fallback configuration
- **WHEN** fallback model requires different provider than primary
- **THEN** the system SHALL automatically determine correct provider type and endpoint for fallback model
