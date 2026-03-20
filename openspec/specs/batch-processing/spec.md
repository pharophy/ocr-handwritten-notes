## Purpose

The Batch Processing capability automatically discovers and processes multiple handwritten note images in configured folders, avoiding duplicate processing and managing output file generation.

## Requirements

### Requirement: Folder monitoring configuration
The system SHALL allow configuration of one or more folders to monitor for handwritten note images.

#### Scenario: Multiple folder support
- **WHEN** multiple folders are configured in MONITORED_FOLDERS
- **THEN** the system SHALL scan all configured folders for images to process

#### Scenario: Nested folder scanning
- **WHEN** a monitored folder contains subdirectories
- **THEN** the system SHALL recursively scan all subdirectories for image files

### Requirement: Image file discovery
The system SHALL automatically discover image files in monitored folders.

#### Scenario: JPEG discovery
- **WHEN** scanning folders
- **THEN** the system SHALL identify files with .jpg or .jpeg extensions (case-insensitive) as candidates for processing

#### Scenario: PNG discovery
- **WHEN** scanning folders
- **THEN** the system SHALL identify files with .png extension (case-insensitive) as candidates for processing

### Requirement: Duplicate processing prevention
The system SHALL avoid reprocessing images that have already been transcribed.

#### Scenario: Existing OCR output check
- **WHEN** an image file '[filename].[ext]' is discovered
- **THEN** the system SHALL check if '[filename].md' exists in the same directory

#### Scenario: Existing summary output check
- **WHEN** an image file '[filename].[ext]' is discovered
- **THEN** the system SHALL check if '[filename] - Summary and Actions.md' exists in the same directory

#### Scenario: Skip processed images
- **WHEN** either the OCR output file or summary output file exists for an image
- **THEN** the system SHALL skip processing that image and log a skip message

### Requirement: Batch OCR processing
The system SHALL process all unprocessed images in a single execution run.

#### Scenario: Sequential processing
- **WHEN** multiple unprocessed images are discovered
- **THEN** the system SHALL process them sequentially, completing each before starting the next

#### Scenario: Process continuation on errors
- **WHEN** OCR or summarization fails for one image
- **THEN** the system SHALL log the error and continue processing remaining images

### Requirement: Output file generation
The system SHALL generate markdown output files in the same directory as source images.

#### Scenario: OCR output file creation
- **WHEN** OCR transcription completes for '[filename].[ext]'
- **THEN** the system SHALL create '[filename].md' containing the transcription in the same directory as the source image

#### Scenario: Summary output file creation
- **WHEN** summarization completes for '[filename].[ext]' and '_nosum' is not in the filename
- **THEN** the system SHALL create '[filename] - Summary and Actions.md' in the same directory as the source image

### Requirement: Output file metadata
The system SHALL include navigation links in generated output files.

#### Scenario: OCR file links
- **WHEN** creating an OCR output file
- **THEN** the first line SHALL contain markdown links to the summary file and original image file

#### Scenario: Summary file links
- **WHEN** creating a summary output file
- **THEN** the first line SHALL contain markdown links to the OCR transcription file and original image file

### Requirement: Execution logging
The system SHALL provide clear console logging for batch processing progress.

#### Scenario: Skip logging
- **WHEN** an image is skipped because it's already processed
- **THEN** the system SHALL log a message: '⏭ Skipping [filename] — already processed.'

#### Scenario: Success logging
- **WHEN** an image is successfully processed
- **THEN** the system SHALL log a message: '✅ Processed [filename]'

#### Scenario: Error logging
- **WHEN** processing fails for an image
- **THEN** the system SHALL log an error message with details

### Requirement: Single-run execution model
The system SHALL execute as a one-time batch process, not a continuous monitor.

#### Scenario: Run to completion
- **WHEN** the tool is executed via 'npm start'
- **THEN** the system SHALL scan folders, process all unprocessed images, and exit when complete

### Requirement: File system traversal
The system SHALL efficiently traverse directory structures to discover images.

#### Scenario: Recursive directory traversal
- **WHEN** scanning a monitored folder
- **THEN** the system SHALL use recursive file system operations to find all image files at any depth
