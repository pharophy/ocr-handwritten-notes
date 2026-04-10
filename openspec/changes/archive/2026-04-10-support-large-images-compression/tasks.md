## 1. Create Compression Utility

- [x] 1.1 Create `compressImageIfNeeded()` function in src/ocr.ts with parameters: buffer, targetSizeBytes, minQuality
- [x] 1.2 Implement progressive quality reduction loop (90 → 80 → 70)
- [x] 1.3 Add compression metrics return type: { buffer, compressed, metrics: { originalSize, compressedSize, quality, ratio } }
- [x] 1.4 Add error handling for images that can't compress to target size with helpful error message
- [x] 1.5 Add detailed logging for compression operations (original size, compressed size, quality, ratio)

## 2. Environment Variable Configuration

- [x] 2.1 Add IMAGE_COMPRESSION_MAX_SIZE_MB to environment variable parsing (default: 5)
- [x] 2.2 Add IMAGE_COMPRESSION_MIN_QUALITY to environment variable parsing (default: 70)
- [x] 2.3 Add IMAGE_COMPRESSION_ENABLED to environment variable parsing (default: true)
- [x] 2.4 Update .env.example with new compression configuration variables and documentation

## 3. Integrate Compression into OCR Pipeline

- [x] 3.1 Call compressImageIfNeeded() after existing Sharp preprocessing in performOCR()
- [x] 3.2 Pass preprocessedBuffer to compression function
- [x] 3.3 Update base64Image encoding to use compressed buffer when compression occurred
- [x] 3.4 Ensure compression is skipped when IMAGE_COMPRESSION_ENABLED=false

## 4. Integrate Compression into Reference Image Loading

- [x] 4.1 Call compressImageIfNeeded() in loadReferenceImage() after reading buffer
- [x] 4.2 Replace size warning logic (currently warns at >5MB) with compression logic
- [x] 4.3 Log compression metrics when reference images are compressed
- [x] 4.4 Maintain backward compatibility with existing reference image loading behavior

## 5. Testing

- [x] 5.1 Add unit test for compressImageIfNeeded() with 3MB buffer (should not compress)
- [x] 5.2 Add unit test for compressImageIfNeeded() with 6MB buffer (should compress to quality=90 or 80)
- [x] 5.3 Add unit test for compressImageIfNeeded() with 15MB buffer (should compress to quality=70)
- [x] 5.4 Add unit test for compressImageIfNeeded() with extremely large buffer (should throw error)
- [x] 5.5 Add integration test for OCR with large test image (verify compression in pipeline)
- [x] 5.6 Add integration test for reference image compression with large reference image
- [x] 5.7 Add test for custom compression configuration via environment variables
- [x] 5.8 Add test for compression disabled scenario (IMAGE_COMPRESSION_ENABLED=false)

## 6. Documentation

- [x] 6.1 Update README.md with image compression feature description
- [x] 6.2 Add troubleshooting section for "Image too large to compress" errors
- [x] 6.3 Document compression environment variables in README configuration section
- [x] 6.4 Add example of compression logging output to README
- [x] 6.5 Update CONFIG.md (if exists) with compression configuration details

## 7. Validation

- [x] 7.1 Test with real-world large images (>5MB) to verify compression works
- [x] 7.2 Verify OCR accuracy is maintained after compression at quality=70
- [x] 7.3 Measure and document compression performance impact (latency)
- [x] 7.4 Test edge case: image that can't compress to <5MB at quality=70
- [x] 7.5 Verify compression metrics are logged correctly in all scenarios
