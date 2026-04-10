# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Documentation reorganization with docs/ directory structure
- Comprehensive documentation audit and cleanup plan

## [1.3.0] - 2026-04-10

### Added
- Automatic image compression for Claude 4.6 Sonnet (5MB limit)
- Progressive JPEG quality reduction (90→80→70) for large images
- Image compression configuration via environment variables
- Comprehensive test suite for image compression functionality
- Complete end-to-end solution architecture documentation
- Semantic constants for all magic numbers across codebase

### Changed
- Extracted all magic numbers to named constants for maintainability
- Applied image preprocessing and compression to validation/correction pipeline
- Updated README with HAI Desktop App setup instructions
- Improved error messages for compression failures

### Fixed
- Critical bug where validation/correction pipeline wasn't compressing images
- Image format consistency (always JPEG after preprocessing)
- Reference image compression for images >5MB

## [1.2.0] - 2026-04-03

### Added
- OCR fallback mechanism with quality assessment
- Cross-provider automatic retry on poor quality results
- Quality metrics tracking (illegible percentage, consecutive illegibles, output length)

### Changed
- Enhanced OCR quality assessment with configurable thresholds
- Improved validation report formatting

## [1.1.0] - 2026-04-02

### Added
- AI provider abstraction layer
- HAI proxy integration with automatic startup
- Support for multiple AI models (Claude and OpenAI)
- Model configuration via handwriting-reference.yaml
- Direct OpenAI provider support

### Changed
- Unified provider interface for all AI completions
- Simplified provider type system (HAI vs OpenAI)

## [1.0.0] - 2026-03-15

### Added
- Initial handwritten note OCR processing
- Sharp image preprocessing (grayscale, resize, normalize, sharpen)
- Handwriting reference support with glossary
- Domain-specific terminology recognition
- Markdown output with automatic summarization
- Batch processing of image folders
- Quality validation and correction pipeline
