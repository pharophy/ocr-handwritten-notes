## Context

The application uses Sharp for image preprocessing before sending to Claude 4.6 Sonnet for OCR. The current preprocessing pipeline (grayscale, resize to 1600px width, normalize, sharpen) reduces dimensions but doesn't guarantee the output buffer will be <5MB. High-resolution scanned images (especially PNG format) can still exceed 5MB after preprocessing, causing API failures.

**Current Implementation:**
- `src/ocr.ts`: Contains preprocessing pipeline using Sharp
- `src/handwritingReference.ts`: Loads reference images with size warning but no compression
- Sharp library is already a dependency, providing built-in compression capabilities

**Constraints:**
- Must preserve text readability - aggressive compression could make handwriting illegible
- Cannot change image dimensions beyond current 1600px width limit (optimized for OCR accuracy)
- Must work with existing Sharp pipeline without breaking current preprocessing
- Compression should be automatic and transparent - no user intervention required

## Goals / Non-Goals

**Goals:**
- Enable processing of images >5MB without manual user intervention
- Preserve OCR accuracy by maintaining text readability during compression
- Provide visibility into compression operations through logging
- Support configurable compression thresholds for different use cases
- Apply compression to both OCR input images and handwriting reference images

**Non-Goals:**
- Support for providers other than Claude (OpenAI has larger limits, ~20MB)
- Client-side image compression before upload (server-side only)
- Automatic format conversion (PNG→JPEG) as a compression strategy (Sharp already converts to grayscale)
- Caching compressed images (compression happens per-request)
- Image quality analysis to determine optimal compression (use fixed strategy)

## Decisions

### Decision 1: Progressive Quality Reduction Strategy
Use iterative quality reduction rather than single-pass compression.

**Approach:**
- Start with quality=90 (high quality, minimal compression)
- If still >5MB, reduce to quality=80
- If still >5MB, reduce to quality=70 (minimum acceptable for text)
- If still >5MB after quality=70, throw error with guidance

**Rationale:**
- Preserves maximum quality when possible (some images may compress well at 90%)
- Provides predictable behavior (users know compression won't go below 70%)
- Iterative approach handles varying image characteristics (photo vs scan, detail density)

**Alternatives Considered:**
- Single-pass at quality=80: May over-compress images that would work at 90%, or under-compress images needing 70%
- Calculate optimal quality mathematically: Complex and unreliable due to content variability
- Dynamic quality based on content analysis: Over-engineered for this use case

### Decision 2: Compress After Preprocessing, Not Before
Apply compression as the final step after grayscale/resize/normalize/sharpen.

**Rationale:**
- Preprocessing already reduces size by converting to grayscale and resizing
- Most images will be <5MB after preprocessing and won't need compression
- Compressing after preprocessing means working with already-optimized buffer
- Avoids re-compressing multiple times if we compressed before each preprocessing step

**Alternatives Considered:**
- Compress before preprocessing: Would need to decompress for preprocessing operations, wasting CPU
- Compress at multiple stages: Adds complexity and potential quality degradation from multiple compressions

### Decision 3: Use JPEG Compression with Sharp
Leverage Sharp's `.jpeg()` method with quality parameter.

**Rationale:**
- Sharp is already a dependency - no new libraries needed
- JPEG is highly effective for grayscale images (our preprocessing already converts to grayscale)
- Quality parameter provides fine-grained control (0-100 scale)
- Sharp handles format conversion seamlessly

**Alternatives Considered:**
- PNG compression with compression level: Less effective than JPEG for grayscale images
- WebP format: Better compression but less universally supported, adds format complexity
- External compression library (mozjpeg, pngquant): Adds dependencies, Sharp is sufficient

### Decision 4: Shared Compression Function
Create a single `compressImageIfNeeded()` utility function used by both OCR and reference image flows.

**Rationale:**
- DRY principle - same compression logic applies to both use cases
- Consistent behavior and logging across the application
- Easier to maintain and test
- Single place to update compression strategy if needed

**Implementation:**
```typescript
async function compressImageIfNeeded(
  buffer: Buffer,
  targetSizeBytes: number = 5 * 1024 * 1024, // 5MB default
  minQuality: number = 70
): Promise<{ buffer: Buffer; compressed: boolean; metrics?: CompressionMetrics }>
```

### Decision 5: Environment Variable Configuration (Optional)
Add optional environment variables but use sensible defaults.

**Configuration:**
- `IMAGE_COMPRESSION_MAX_SIZE_MB`: Default 5MB (Claude limit)
- `IMAGE_COMPRESSION_MIN_QUALITY`: Default 70 (minimum acceptable quality)
- `IMAGE_COMPRESSION_ENABLED`: Default true (can disable for testing)

**Rationale:**
- Most users don't need to configure - defaults work for Claude 4.6 Sonnet
- Power users can tune for specific needs (e.g., raise quality floor for critical documents)
- Testing can disable compression to verify behavior

**Alternatives Considered:**
- No configuration: Less flexible for edge cases
- Required configuration: Adds setup friction for all users
- Per-image configuration via API: Over-engineered, adds API complexity

## Risks / Trade-offs

### Risk: Quality Loss from Compression
**Risk:** Text might become illegible after compression to 70% quality.

**Mitigation:** 
- Set minimum quality at 70% based on testing (below this, text degrades noticeably)
- Fail fast if image won't compress to <5MB at quality=70
- Log compression metrics so users can see when compression occurred
- Error message suggests manual preprocessing if compression fails

### Risk: Performance Impact
**Risk:** Iterative compression adds latency to OCR processing.

**Mitigation:**
- Only compress images >5MB (most images won't need compression after preprocessing)
- Sharp is highly optimized and fast (typically <500ms for compression)
- Progressive reduction means we stop as soon as size threshold is met
- For batch processing, latency is acceptable (users already wait for OCR)

### Trade-off: JPEG Artifacts vs File Size
**Trade-off:** JPEG compression introduces artifacts that could affect OCR accuracy.

**Mitigation:**
- Quality=70 is conservative threshold (minimal visible artifacts for text)
- Grayscale conversion before compression reduces color artifacts
- Preprocessing already sharpens the image, which helps maintain edge clarity
- Claude 4.6 Sonnet is robust to minor compression artifacts

### Risk: Edge Cases with Ultra-Dense Images
**Risk:** Some images may be inherently too large to compress to <5MB without severe quality loss.

**Mitigation:**
- Detect and fail with helpful error message: "Image too large to compress. Please resize manually to <X megapixels"
- Log original dimensions and suggest target resolution
- Document this limitation in README troubleshooting section

## Migration Plan

**Deployment:**
1. Add compression function to `src/ocr.ts` (new function, no breaking changes)
2. Update preprocessing pipeline in `performOCR()` to call compression after Sharp operations
3. Update `loadReferenceImage()` in `src/handwritingReference.ts` to compress reference images
4. Add environment variable parsing in config loading
5. Update `.env.example` with new optional configuration variables
6. Update README with compression documentation

**Rollback:**
- If compression causes OCR issues, set `IMAGE_COMPRESSION_ENABLED=false` in `.env`
- No database or persistent state changes - rollback is immediate

**Testing:**
- Unit tests for compression function with various image sizes and qualities
- Integration tests with sample large images (6MB, 10MB, 15MB) to verify compression
- Edge case tests: images that can't compress to <5MB
- Performance tests: measure compression latency impact

## Open Questions

None - design is complete and ready for implementation.
