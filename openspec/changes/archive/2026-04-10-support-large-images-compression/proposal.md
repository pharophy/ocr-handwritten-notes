## Why

Claude 4.6 Sonnet has a 5MB limit for image inputs, but high-resolution scanned handwritten notes often exceed this size (6-15MB). Currently, the system only warns users about large images but doesn't process them, resulting in failed OCR operations. Users must manually resize images before processing, creating friction and preventing automated batch processing of large image sets.

## What Changes

- Add automatic image compression for images >5MB before sending to Claude 4.6 Sonnet
- Implement intelligent quality-based compression that preserves text readability while reducing file size
- Add configuration options for compression thresholds and quality settings
- Maintain existing preprocessing pipeline (grayscale, resize, normalize, sharpen) and add compression as a final step
- Log compression metrics (original size, compressed size, compression ratio) for transparency
- Support both reference images and OCR input images

## Capabilities

### New Capabilities
- `image-compression`: Automatic image size reduction for images exceeding provider limits, using quality-based JPEG compression while preserving text readability

### Modified Capabilities
- `ocr-processing`: Update image preprocessing to include compression step for images >5MB
- `handwriting-reference`: Apply same compression logic to reference images that exceed size limits

## Impact

**Code Changes:**
- `src/ocr.ts`: Add compression logic after existing sharp preprocessing pipeline
- `src/handwritingReference.ts`: Add compression logic for reference image loading
- New utility function for compression with configurable quality settings

**Configuration:**
- `.env` files: New optional variables for compression thresholds and quality (with smart defaults)
- No breaking changes - compression is automatic and transparent to users

**Behavior Changes:**
- Images >5MB will be automatically compressed to <5MB before API calls
- Compression uses progressive quality reduction (starting at 90%, reducing to 70% if needed)
- Warning logs will show compression metrics when images are compressed
- Existing images <5MB are unchanged - no performance impact
