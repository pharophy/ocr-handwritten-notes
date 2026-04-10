## MODIFIED Requirements

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
