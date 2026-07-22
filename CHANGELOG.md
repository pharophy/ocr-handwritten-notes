# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Vertical segmentation for tall images: pages taller than `SEGMENT_MAX_HEIGHT`
  (2200px) are split into full-resolution overlapping strips, OCR'd separately,
  and stitched back together so tall notes are no longer downsampled to illegibility
- Detection of dropped OCR segments: an empty interior segment marks the
  transcription incomplete and triggers the fallback model instead of silently
  returning a page with a missing section
- Documentation reorganization with docs/ directory structure
- Comprehensive documentation audit and cleanup plan

### Changed
- OCR preprocessing now caps image width only (preserving aspect ratio) instead of
  forcing both width and height into a bounding box, which previously squished tall
  pages horizontally. Extracted as a shared `preprocessImageForOCR` helper used by both
  the primary OCR path and the phrase-correction path so they can't drift apart
- Phrase correction now runs on the same width-only, vertically-segmented imagery as
  primary OCR (each strip queried with a `NOT_PRESENT` guard to locate the phrase)
  instead of re-reading a downsampled full page
- Reasoning models (`gpt-5*`, `gpt-4.1*`) now request up to 16000 completion tokens
  so hidden reasoning tokens no longer exhaust the budget and leave empty output

### Fixed
- Hallucinated OCR output on very tall images (e.g. long stitched note scans) caused
  by horizontal squishing before the vision call, in both the primary OCR path and the
  phrase-correction pass (the latter previously still downsampled the full page)
- Empty summaries from reasoning models when reasoning tokens consumed the entire
  `max_completion_tokens` budget

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
- Updated README with direct provider setup instructions
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
- Direct provider integration
- Support for multiple AI models across Anthropic and OpenAI
- Model configuration via handwriting-reference.yaml
- Direct OpenAI provider support

### Changed
- Unified provider interface for all AI completions
- Simplified provider type system

## [1.0.0] - 2026-03-15

### Added
- Initial handwritten note OCR processing
- Sharp image preprocessing (grayscale, resize, normalize, sharpen)
- Handwriting reference support with glossary
- Domain-specific terminology recognition
- Markdown output with automatic summarization
- Batch processing of image folders
- Quality validation and correction pipeline
