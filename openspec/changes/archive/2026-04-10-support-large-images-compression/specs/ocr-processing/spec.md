## MODIFIED Requirements

### Requirement: Image preprocessing
The system SHALL preprocess handwritten images to enhance text clarity and readability before OCR processing, including automatic compression for oversized images.

#### Scenario: Standard image preprocessing
- **WHEN** a handwritten image is submitted for OCR processing
- **THEN** the image SHALL be converted to grayscale, resized to 1600px width, normalized for contrast and brightness, and sharpened

#### Scenario: Preprocessing with compression for large images
- **WHEN** a handwritten image is submitted for OCR processing and the preprocessed buffer exceeds 5MB
- **THEN** the image SHALL be automatically compressed using progressive quality reduction to meet the 5MB limit before being sent to the AI provider
