## ADDED Requirements

### Requirement: Automatic compression for oversized images
The system SHALL automatically compress images that exceed the provider's size limit before sending them for processing.

#### Scenario: Image exceeds size limit
- **WHEN** an image buffer exceeds 5MB after preprocessing
- **THEN** the system SHALL compress the image using JPEG compression with progressive quality reduction

#### Scenario: Image within size limit
- **WHEN** an image buffer is 5MB or less after preprocessing
- **THEN** the system SHALL NOT apply compression and use the preprocessed buffer directly

### Requirement: Progressive quality reduction
The system SHALL use iterative quality reduction to achieve target file size while preserving maximum image quality.

#### Scenario: Compression with high quality succeeds
- **WHEN** compressing an image at quality=90 results in size ≤5MB
- **THEN** the system SHALL use the quality=90 compressed buffer and stop iteration

#### Scenario: Compression requires medium quality
- **WHEN** compressing at quality=90 results in size >5MB but quality=80 results in size ≤5MB
- **THEN** the system SHALL use the quality=80 compressed buffer

#### Scenario: Compression requires minimum quality
- **WHEN** compressing at quality=90 and quality=80 both result in size >5MB but quality=70 results in size ≤5MB
- **THEN** the system SHALL use the quality=70 compressed buffer

#### Scenario: Image cannot be compressed sufficiently
- **WHEN** compressing at quality=70 still results in size >5MB
- **THEN** the system SHALL throw an error with guidance to manually resize the image

### Requirement: Compression transparency and logging
The system SHALL provide visibility into compression operations through detailed logging.

#### Scenario: Compression applied successfully
- **WHEN** an image is compressed to meet size requirements
- **THEN** the system SHALL log original size, compressed size, quality used, and compression ratio

#### Scenario: No compression needed
- **WHEN** an image does not require compression
- **THEN** the system SHALL NOT log compression metrics

#### Scenario: Compression failure
- **WHEN** an image cannot be compressed to target size
- **THEN** the system SHALL log the failure with original size, attempted quality levels, and suggested resolution

### Requirement: Configurable compression parameters
The system SHALL support optional environment variable configuration for compression behavior.

#### Scenario: Default compression configuration
- **WHEN** no compression environment variables are set
- **THEN** the system SHALL use 5MB as max size, 70 as minimum quality, and compression enabled

#### Scenario: Custom compression threshold
- **WHEN** IMAGE_COMPRESSION_MAX_SIZE_MB environment variable is set
- **THEN** the system SHALL use that value as the target size threshold

#### Scenario: Custom minimum quality
- **WHEN** IMAGE_COMPRESSION_MIN_QUALITY environment variable is set to a value between 1-100
- **THEN** the system SHALL use that value as the lowest quality threshold before failing

#### Scenario: Compression disabled
- **WHEN** IMAGE_COMPRESSION_ENABLED environment variable is set to false
- **THEN** the system SHALL skip compression entirely and process images as-is

### Requirement: Consistent compression across image types
The system SHALL apply the same compression logic to both OCR input images and handwriting reference images.

#### Scenario: OCR input image compression
- **WHEN** an OCR input image exceeds 5MB after preprocessing
- **THEN** the system SHALL apply progressive quality compression before sending to AI provider

#### Scenario: Reference image compression
- **WHEN** a handwriting reference image exceeds 5MB when loaded
- **THEN** the system SHALL apply progressive quality compression before including in prompts
