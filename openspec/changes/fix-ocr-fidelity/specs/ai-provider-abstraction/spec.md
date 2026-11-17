## ADDED Requirements

### Requirement: Multiple images and detail level per vision call
The vision call in the provider abstraction SHALL accept optional additional images (sent before the target image, in order) and an optional detail level, and each adapter SHALL map them to its provider's format.

#### Scenario: Reference image sent before the target
- **WHEN** a vision call is made with one additional image and a target image
- **THEN** the OpenAI and Anthropic adapters SHALL each send the additional image first and the target image second in the same user message

#### Scenario: Detail level on OpenAI
- **WHEN** a vision call is made with detail `high` through the OpenAI adapter
- **THEN** every image part in the request SHALL carry `detail: "high"`

#### Scenario: Detail level ignored where unsupported
- **WHEN** a vision call is made with a detail level through an adapter whose provider has no such setting
- **THEN** the adapter SHALL ignore it without error

#### Scenario: Existing single-image callers unchanged
- **WHEN** a vision call is made without additional images or detail
- **THEN** the request SHALL be the same as before this change
