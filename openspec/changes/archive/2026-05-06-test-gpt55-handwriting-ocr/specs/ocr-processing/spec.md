## MODIFIED Requirements

### Requirement: Handwriting transcription accuracy
The system SHALL transcribe handwritten text with character-level fidelity, preserving all content without summarization or omission. The system SHALL support latest OpenAI models (GPT-5, GPT-4.1) and Claude models as options for handwriting recognition.

#### Scenario: Complete transcription
- **WHEN** a handwritten image is processed
- **THEN** every word, symbol, and punctuation mark SHALL be transcribed exactly as written

#### Scenario: Ambiguous characters
- **WHEN** a character or word is unclear or ambiguous in the handwriting
- **THEN** the system SHALL make a best-effort interpretation and mark it with *italics* for user review

#### Scenario: No content skipping
- **WHEN** processing any handwritten content
- **THEN** the system SHALL NOT skip, abbreviate, or summarize any portion of the handwritten text

#### Scenario: Latest model usage
- **WHEN** GPT-5, GPT-4.1, or other latest models are configured as the OCR model
- **THEN** the system SHALL use the specified model's vision capabilities for handwriting transcription with the same accuracy requirements
