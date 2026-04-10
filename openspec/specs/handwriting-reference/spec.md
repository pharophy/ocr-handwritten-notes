## Purpose

The Handwriting Reference capability improves OCR character recognition accuracy by providing personalized examples of how a specific user writes letters, numbers, and words.
## Requirements
### Requirement: Handwriting reference configuration
The system SHALL support optional handwriting reference configuration to improve OCR character recognition accuracy.

#### Scenario: Configuration file loading
- **WHEN** the system starts OCR processing
- **THEN** it SHALL attempt to load handwriting reference from 'handwriting-reference.json' in the root directory

#### Scenario: Missing configuration
- **WHEN** no handwriting reference configuration file exists
- **THEN** the system SHALL continue with standard OCR processing without errors

#### Scenario: Invalid configuration
- **WHEN** the configuration file contains invalid JSON
- **THEN** the system SHALL log a warning and continue with standard OCR processing

### Requirement: Reference configuration format
The system SHALL support a JSON configuration format with reference words, special characters, and optional image path.

#### Scenario: Text-based reference
- **WHEN** the configuration contains 'referenceWords' array
- **THEN** the system SHALL use these words as textual context for OCR character recognition

#### Scenario: Image-based reference
- **WHEN** the configuration contains 'referenceImagePath' pointing to an existing image file
- **THEN** the system SHALL load the reference image and send it alongside target images to the OCR API

#### Scenario: Special characters reference
- **WHEN** the configuration contains 'specialCharacters' array
- **THEN** the system SHALL include these in the handwriting reference context

### Requirement: Reference image loading
The system SHALL load, validate, and compress reference images specified in the configuration.

#### Scenario: Valid reference image
- **WHEN** a reference image path is specified and the file exists
- **THEN** the system SHALL load the image as a buffer and include it in OCR API calls

#### Scenario: Missing reference image
- **WHEN** a reference image path is specified but the file does not exist
- **THEN** the system SHALL log a warning and fall back to text-based reference or standard OCR

#### Scenario: Large reference images
- **WHEN** a reference image exceeds 5MB in size
- **THEN** the system SHALL automatically compress the image using progressive quality reduction to meet the 5MB limit before including it in OCR API calls

#### Scenario: Invalid image format
- **WHEN** a reference image has an extension other than .jpg, .jpeg, or .png
- **THEN** the system SHALL log a warning but attempt to process it

### Requirement: Reference caching
The system SHALL cache loaded handwriting references to avoid redundant file operations.

#### Scenario: Reference loaded once
- **WHEN** processing multiple images in a batch
- **THEN** the handwriting reference SHALL be loaded only once and reused for all subsequent OCR calls

### Requirement: Prompt enhancement with text reference
The system SHALL inject text-based reference words into the OCR system prompt when available.

#### Scenario: Text reference prompt formatting
- **WHEN** reference words are available but no reference image exists
- **THEN** the system SHALL format the reference words by category (uppercase, lowercase, numbers, mixed) and append them to the system prompt with instructions for character disambiguation

#### Scenario: Empty reference words
- **WHEN** the reference words array is empty
- **THEN** the system SHALL not add any reference content to the prompt

### Requirement: Image reference API integration
The system SHALL send reference images alongside target images in multi-image API calls when available.

#### Scenario: Reference image attachment
- **WHEN** a reference image is loaded and a target image is being processed
- **THEN** the API call SHALL include the reference image first, followed by the target image, in the user message content array

#### Scenario: Reference image instructions
- **WHEN** including a reference image in the API call
- **THEN** the system prompt SHALL include specific instructions for using the reference image to compare letter formations and improve character recognition

### Requirement: Hybrid reference approach
The system SHALL support using both text and image references with appropriate fallback behavior.

#### Scenario: Image reference priority
- **WHEN** both reference image and reference words are available
- **THEN** the system SHALL use the image reference (more accurate) and include image-specific instructions in the prompt

#### Scenario: Text reference fallback
- **WHEN** reference words exist but the reference image cannot be loaded
- **THEN** the system SHALL fall back to text-based reference in the prompt

### Requirement: Environment variable configuration
The system SHALL support environment variables for controlling handwriting reference behavior.

#### Scenario: Feature toggle
- **WHEN** HANDWRITING_REFERENCE_ENABLED is set to 'false' in environment variables
- **THEN** the system SHALL not attempt to load or use handwriting reference

#### Scenario: Custom config path
- **WHEN** HANDWRITING_REFERENCE_FILE environment variable is set
- **THEN** the system SHALL load the configuration from the specified path instead of the default

### Requirement: Logging and observability
The system SHALL provide clear logging messages about handwriting reference loading status.

#### Scenario: Successful reference load
- **WHEN** reference configuration and/or image are loaded successfully
- **THEN** the system SHALL log confirmation messages indicating what was loaded

#### Scenario: Reference warnings
- **WHEN** reference files are missing, malformed, or have issues
- **THEN** the system SHALL log warning messages that help users troubleshoot

### Requirement: Character disambiguation guidance
The system SHALL provide specific guidance to the OCR model for disambiguating commonly confused letters.

#### Scenario: Confusion mitigation
- **WHEN** including reference context in the prompt
- **THEN** the instructions SHALL specifically mention commonly confused letter pairs (l/I/1, a/o, u/v, m/n, 0/O) and guide the model to use reference examples for disambiguation

