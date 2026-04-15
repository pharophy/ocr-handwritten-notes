## Purpose

The OCR Testing capability provides an automated framework for validating OCR transcription accuracy against gold standard expected outputs, enabling measurement of transcription quality and regression detection.

## ADDED Requirements

### Requirement: Gold standard test case support
The system SHALL support test cases with input images and corresponding expected text outputs for accuracy validation.

#### Scenario: Test case directory structure
- **WHEN** test images are provided in the test-images directory
- **THEN** the system SHALL recognize paired files where `<name>.jpeg` has a corresponding `<name> expected.txt` file containing the expected transcription

#### Scenario: Expected output format
- **WHEN** an expected output file exists for a test image
- **THEN** the expected output SHALL be in plain text or Markdown format matching the system's OCR output format

### Requirement: Accuracy comparison metrics
The system SHALL compute quantitative accuracy metrics by comparing OCR output against expected text.

#### Scenario: Character-level accuracy
- **WHEN** comparing OCR output to expected text
- **THEN** the system SHALL compute character edit distance (Levenshtein distance) and character accuracy percentage

#### Scenario: Word-level accuracy
- **WHEN** comparing OCR output to expected text
- **THEN** the system SHALL compute word-level precision, recall, and F1 score

#### Scenario: Line-level accuracy
- **WHEN** comparing OCR output to expected text
- **THEN** the system SHALL identify which lines match exactly, which lines have errors, and provide line-by-line difference highlighting

### Requirement: Test execution and reporting
The system SHALL execute test cases and generate comprehensive accuracy reports.

#### Scenario: Single test case execution
- **WHEN** running a test for a specific image with expected output
- **THEN** the system SHALL process the image, compare against expected output, and report accuracy metrics

#### Scenario: Batch test execution
- **WHEN** running tests for all images with expected outputs in a directory
- **THEN** the system SHALL process all test cases and generate an aggregate accuracy report

#### Scenario: Test failure identification
- **WHEN** OCR output does not meet accuracy thresholds
- **THEN** the system SHALL report which specific sections or phrases differ from expected output with visual diff formatting

### Requirement: Baseline tracking and comparison
The system SHALL maintain baseline test results and compare new test runs against the baseline to measure improvement or regression.

#### Scenario: Baseline storage
- **WHEN** a test run completes and baseline results do not exist
- **THEN** the system SHALL store the test results as the baseline including model name, accuracy metrics, cost estimate, and timestamp

#### Scenario: Baseline comparison
- **WHEN** running tests with an existing baseline
- **THEN** the system SHALL compare current results against baseline and report deltas for accuracy percentage, cost per image, processing latency, and other tracked metrics

#### Scenario: Multi-dimensional tracking
- **WHEN** storing test results
- **THEN** the system SHALL track accuracy (character %, word F1), cost (estimated API cost), performance (processing time), and quality indicators (italic count, illegible count)

#### Scenario: Baseline update
- **WHEN** a new configuration demonstrates consistent improvement across multiple test cases
- **THEN** the system SHALL support updating the baseline to reflect the new standard for future comparisons

#### Scenario: Regression detection
- **WHEN** new test results show decreased accuracy or increased cost compared to baseline
- **THEN** the system SHALL clearly flag these regressions in the test report

### Requirement: Test report formatting
The system SHALL generate human-readable test reports with clear success/failure indicators.

#### Scenario: Console test output
- **WHEN** tests complete
- **THEN** the system SHALL output a summary showing pass/fail status, overall accuracy percentage, and key metrics for each test case

#### Scenario: Detailed diff output
- **WHEN** a test case fails
- **THEN** the system SHALL display a side-by-side or unified diff showing expected vs actual output with highlighted differences

#### Scenario: Markdown report generation
- **WHEN** batch tests complete
- **THEN** the system SHALL optionally generate a Markdown report file with all test results, metrics, and diffs

### Requirement: Test command interface
The system SHALL provide a command-line interface for running OCR tests.

#### Scenario: Test command
- **WHEN** user runs the test command with a test image path
- **THEN** the system SHALL execute the test and report results

#### Scenario: Test suite command
- **WHEN** user runs the test suite command
- **THEN** the system SHALL discover and run all test cases with expected outputs in the test directory
