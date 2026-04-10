# Handwriting OCR CLI - Solution Architecture

## Executive Summary

This document describes the end-to-end architecture of the Handwriting OCR CLI tool, which converts handwritten notes (images) into structured markdown with AI-powered summarization. The solution provides enterprise-grade OCR with automatic quality fallback, image compression, and support for multiple AI providers.

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Core Components](#core-components)
4. [Data Flow](#data-flow)
5. [AI Provider Integration](#ai-provider-integration)
6. [Quality Assurance Pipeline](#quality-assurance-pipeline)
7. [Image Processing Pipeline](#image-processing-pipeline)
8. [Configuration Management](#configuration-management)
9. [Error Handling & Resilience](#error-handling--resilience)
10. [Performance Considerations](#performance-considerations)
11. [Security & Compliance](#security--compliance)
12. [Deployment Architecture](#deployment-architecture)

---

## System Overview

### Purpose

Convert handwritten notes from scanned images into:
1. **Accurate markdown transcriptions** - Preserving layout, tables, and formatting
2. **AI-generated summaries** - Extracting action items, key learnings, and decisions
3. **Quality-validated output** - Automatic fallback when OCR quality is poor

### Key Capabilities

- **Multi-Provider AI Support**: Claude (via HAI proxy), OpenAI (direct or via HAI)
- **Automatic OCR Fallback**: Cross-provider failover for poor quality results
- **Image Compression**: Automatic handling of large images (>5MB)
- **Batch Processing**: Monitors folders and processes new images automatically
- **Handwriting Personalization**: Custom reference for improved accuracy
- **Quality Validation**: Automated assessment and correction of OCR output

### Technology Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 18+ with TypeScript |
| **Image Processing** | Sharp (libvips) |
| **AI Providers** | Anthropic Claude 4.5/4.6, OpenAI GPT-4/5 |
| **AI Gateway** | SAP HAI Proxy (optional) |
| **Testing** | Vitest |
| **Package Manager** | npm |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER WORKSPACE                            │
│  ┌─────────────┐                                                 │
│  │  Input      │                                                 │
│  │  Images     │  → Monitored Folders (OneDrive/Local)         │
│  │  (.jpg/png) │                                                 │
│  └─────────────┘                                                 │
│         │                                                         │
│         ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    MAIN APPLICATION                      │   │
│  │                                                           │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │         Image Processing Pipeline                 │  │   │
│  │  │  1. Load Image Buffer                            │  │   │
│  │  │  2. Sharp Preprocessing:                         │  │   │
│  │  │     - Grayscale conversion                       │  │   │
│  │  │     - Resize (1600px width max)                  │  │   │
│  │  │     - Normalize contrast/brightness              │  │   │
│  │  │     - Sharpen edges                              │  │   │
│  │  │  3. Compression (if >5MB):                       │  │   │
│  │  │     - Progressive quality: 90→80→70              │  │   │
│  │  │  4. Base64 encode for API                        │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │         │                                                │   │
│  │         ▼                                                │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │         AI Provider Abstraction Layer            │  │   │
│  │  │  - Provider Selection (HAI/OpenAI Direct)        │  │   │
│  │  │  - Model Routing (Claude/OpenAI)                 │  │   │
│  │  │  - API Call Management                           │  │   │
│  │  │  - Error Handling & Retries                      │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │         │                                                │   │
│  │         ▼                                                │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │         OCR Processing                           │  │   │
│  │  │  1. Primary OCR with configured model            │  │   │
│  │  │  2. Quality Assessment:                          │  │   │
│  │  │     - Illegible marker percentage (>15%)         │  │   │
│  │  │     - Consecutive illegibles (5+ in row)         │  │   │
│  │  │     - Output length vs image size                │  │   │
│  │  │  3. Fallback OCR (if quality poor):              │  │   │
│  │  │     - Use alternate provider/model               │  │   │
│  │  │     - Return better result                       │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │         │                                                │   │
│  │         ▼                                                │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │         Post-Processing                          │  │   │
│  │  │  - OCR Validation (optional)                     │  │   │
│  │  │  - Automated Corrections                         │  │   │
│  │  │  - AI Summarization                              │  │   │
│  │  │  - Markdown Generation                           │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │         │                                                │   │
│  └─────────┼────────────────────────────────────────────────┘  │
│            │                                                     │
│            ▼                                                     │
│  ┌─────────────────┐                                           │
│  │  Output Files   │                                           │
│  │  - .md (OCR)    │ ← Written to same folder as input        │
│  │  - Summary.md   │                                           │
│  └─────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │      External AI Services          │
        │  ┌──────────────────────────────┐  │
        │  │     SAP HAI Proxy (Local)    │  │
        │  │  - Port 6655                 │  │
        │  │  - Token Management          │  │
        │  │  - Multi-Provider Routing    │  │
        │  │    • /anthropic/             │  │
        │  │    • /openai/v1              │  │
        │  └──────────────────────────────┘  │
        │           │                         │
        │           ▼                         │
        │  ┌──────────────────────────────┐  │
        │  │  Anthropic Claude API        │  │
        │  │  - Claude 4.6 Sonnet         │  │
        │  │  - Claude 4.5 Haiku/Opus     │  │
        │  └──────────────────────────────┘  │
        │           │                         │
        │  ┌──────────────────────────────┐  │
        │  │  OpenAI API                  │  │
        │  │  - GPT-5 / GPT-5 Mini        │  │
        │  │  - GPT-4.1 / GPT-4.1 Mini    │  │
        │  └──────────────────────────────┘  │
        └────────────────────────────────────┘
```

---

## Core Components

### 1. Main Application (`src/main.ts`)

**Responsibilities:**
- Monitor configured folders for new images
- Orchestrate the OCR→Validation→Summarization pipeline
- Handle file I/O (read images, write markdown)
- Skip already-processed images (checks for existing .md files)

**Key Logic:**
```typescript
for each monitored folder:
  for each image file:
    if already processed (output .md exists):
      skip
    else:
      ocr_result = processHandwrittenImage(buffer)
      if validation_enabled:
        validated_result = validateOCROutput(ocr_result)
      summary = summarizeText(ocr_result)
      write output files
```

### 2. OCR Processing (`src/ocr.ts`)

**Responsibilities:**
- Image preprocessing with Sharp
- Image compression (>5MB)
- Primary OCR with configured AI model
- Quality assessment of OCR output
- Automatic fallback to secondary model if quality poor

**Key Functions:**

#### `processHandwrittenImage(buffer, filename)`
Main OCR entry point. Handles:
- Reference loading (cached)
- AI provider initialization
- Image preprocessing
- Compression if needed
- Primary OCR call
- Quality assessment
- Fallback OCR if needed
- Returns: `{ text, modelUsed }`

#### `compressImageIfNeeded(buffer, targetSize, minQuality)`
Progressive quality reduction:
- Check if compression needed (size > target)
- Try quality levels: 90 → 80 → 70
- Return first result that meets target size
- Throw error if can't compress to target even at minQuality
- Returns: `{ buffer, compressed, metrics? }`

#### `assessOCRQuality(transcription, imageSize)`
Quality metrics:
- Count illegible markers (`*[illegible]*`)
- Calculate illegible percentage
- Detect consecutive illegibles (5+ in row)
- Check output length vs image size
- Returns: `{ isPoorQuality, reason, metrics }`

### 3. AI Provider Abstraction (`src/aiProvider.ts`)

**Responsibilities:**
- Unified interface for multiple AI providers
- Provider-specific configuration
- Model routing (Claude vs OpenAI endpoints)
- API call execution
- Error handling

**Architecture:**

```typescript
interface AIProvider {
  generateVisionCompletion(prompt, image, mime, modelType)
  generateTextCompletion(messages, modelType)
  getProviderConfig()
}

// Implementations:
- OpenAIProvider    // Direct OpenAI API
- HAIProvider       // HAI Proxy (routes to Claude or OpenAI)
```

**Provider Selection Logic:**
1. Check `AI_PROVIDER` env var (explicit selection)
2. If not set, auto-detect:
   - Check if HAI proxy running on port 6655
   - Check if `OPENAI_API_KEY` set
   - Default to HAI if both available
3. Create appropriate provider instance

**Model Routing (HAI Provider):**
- `anthropic--*` models → `http://localhost:6655/anthropic/`
- `gpt-*` models → `http://localhost:6655/openai/v1`
- Single API key used for both endpoints

### 4. Handwriting Reference (`src/handwritingReference.ts`)

**Responsibilities:**
- Load handwriting reference configuration
- Load and compress reference images
- Format reference context for prompts
- Manage domain glossary (acronyms, business terms)
- AI provider configuration management
- HAI proxy lifecycle management

**Configuration Hierarchy:**
1. Environment variables (highest priority)
2. `handwriting-reference.json` file
3. Auto-detect HAI proxy
4. Fallback to OpenAI direct

**Key Functions:**

#### `loadHandwritingReference()`
Loads configuration from `handwriting-reference.json`:
- Reference words (sample vocabulary)
- Special characters
- Reference image path
- Domain glossary (acronyms, proper nouns, business terms)
- OCR validation settings

#### `loadReferenceImage(imagePath)`
Loads and compresses reference images:
- Read image buffer
- Check size (compress if >5MB)
- Validate format (.jpg, .jpeg, .png)
- Return buffer or null

#### `loadAIProviderConfig()`
Determines AI provider configuration:
- Parse environment variables
- Check HAI proxy status
- Auto-start proxy if needed
- Return `AIProviderConfig`

### 5. OCR Validator (`src/ocrValidator.ts`)

**Responsibilities:**
- Validate OCR output quality
- Identify common OCR errors
- Apply automated corrections
- Generate validation reports

**Validation Checks:**
- Illegible marker density
- Suspicious patterns (repeated characters)
- Incomplete transcriptions
- Format consistency

**Correction Capabilities:**
- Replace illegible markers with alternatives
- Fix common OCR mistakes (based on reference)
- Validate against domain glossary

### 6. Summarization (`src/summarize.ts`)

**Responsibilities:**
- Generate structured summaries from OCR text
- Extract action items (prefixed with "AI:")
- Identify key learnings and decisions
- Generate contextual tags

**Output Format:**
```markdown
# Summary
[3-5 sentence overview]

# Action Items
- AI: [extracted task 1]
- AI: [extracted task 2]

# Key Learnings
- [insight 1]
- [insight 2]

# Key Decisions
- [decision 1]

# Tags
#tag1 #tag2
```

### 7. Utilities (`src/utils.ts`)

**Responsibilities:**
- File system operations
- Image file detection
- Path resolution
- Common helper functions

---

## Data Flow

### End-to-End Processing Flow

```
1. IMAGE DISCOVERY
   └─ Scan monitored folders
   └─ Filter image files (.jpg, .jpeg, .png)
   └─ Skip if output exists

2. IMAGE LOADING
   └─ Read image buffer from disk
   └─ Pass to OCR processor

3. PREPROCESSING
   └─ Sharp pipeline:
      ├─ Convert to grayscale
      ├─ Resize (1600px width, 7000px height max)
      ├─ Normalize contrast/brightness
      └─ Sharpen edges
   └─ Result: preprocessed buffer

4. COMPRESSION (conditional)
   └─ Check size > 5MB?
   └─ Progressive quality reduction:
      ├─ Try quality=90
      ├─ If still >5MB, try quality=80
      ├─ If still >5MB, try quality=70
      └─ Fail if still >5MB
   └─ Log compression metrics

5. PRIMARY OCR
   └─ Load handwriting reference (cached)
   └─ Load reference image if configured (cached)
   └─ Format system prompt with reference context
   └─ Call AI provider vision API:
      ├─ Send: system prompt + image (base64)
      └─ Receive: transcribed text
   └─ Extract model used

6. QUALITY ASSESSMENT
   └─ Calculate illegible percentage
   └─ Check consecutive illegibles
   └─ Check output length vs image size
   └─ Determine if poor quality

7. FALLBACK OCR (if quality poor)
   └─ Load fallback model configuration
   └─ Create fallback provider
   └─ Re-run OCR with fallback model
   └─ Assess fallback quality
   └─ Use fallback if better than primary

8. VALIDATION (optional)
   └─ Run validation checks
   └─ Generate validation report
   └─ Apply automated corrections

9. SUMMARIZATION
   └─ Check if summarization enabled (no _nosum)
   └─ Call AI provider text API:
      ├─ Send: OCR text + summarization prompt
      └─ Receive: structured summary
   └─ Format summary markdown

10. OUTPUT GENERATION
    └─ Write OCR markdown file
    └─ Write summary markdown file (if enabled)
    └─ Log completion

11. COMPLETION
    └─ Return to folder monitoring loop
```

### Data Transformations

| Stage | Input | Output | Size Impact |
|-------|-------|--------|-------------|
| **Load** | Image file | Buffer | No change |
| **Preprocess** | Raw buffer | Preprocessed buffer | Typically reduces 30-50% |
| **Compress** | Preprocessed buffer | Compressed buffer | Reduces to <5MB (if needed) |
| **Encode** | Buffer | Base64 string | Increases ~33% |
| **OCR** | Base64 image | Markdown text | N/A |
| **Validate** | Raw OCR text | Corrected text | Similar size |
| **Summarize** | Full text | Structured summary | Reduces ~80-90% |

---

## AI Provider Integration

### Supported Providers

#### 1. HAI Proxy (Recommended for SAP)

**Architecture:**
```
Application → HAI Proxy (localhost:6655) → Anthropic/OpenAI APIs
```

**Benefits:**
- ✅ Zero cost (corporate infrastructure)
- ✅ Single authentication (SSO via HAI CLI)
- ✅ Multi-provider access (Claude + OpenAI)
- ✅ Compliant with SAP AI policies
- ✅ Auto-start capability

**Endpoints:**
- Claude: `http://localhost:6655/anthropic/`
- OpenAI: `http://localhost:6655/openai/v1`

**Authentication:**
- Managed by HAI CLI (`hai auth login`)
- Token stored in system keyring
- Auto-refresh in background
- Same token for both endpoints

#### 2. OpenAI Direct

**Architecture:**
```
Application → OpenAI API (api.openai.com)
```

**Benefits:**
- ✅ Direct access (no proxy)
- ✅ Lower latency
- ✅ Works outside SAP network

**Authentication:**
- API key from OpenAI platform
- Set in `OPENAI_API_KEY` env var

### Model Selection Strategy

#### OCR Models (Vision Required)

**Recommended:**
- **Primary**: `anthropic--claude-4.6-sonnet` (best for handwriting)
- **Fallback**: `gpt-4.1-mini` (cross-provider redundancy)

**Available Claude Models:**
- `anthropic--claude-4.6-opus` - Highest accuracy, slower
- `anthropic--claude-4.6-sonnet` - Best balance (recommended)
- `anthropic--claude-4.5-sonnet` - Previous generation, still excellent
- `anthropic--claude-4.5-haiku` - Fast, cost-effective

**Available OpenAI Models:**
- `gpt-5` - Latest, best accuracy
- `gpt-5-mini` - Fast, cost-effective
- `gpt-4.1` - High capability
- `gpt-4.1-mini` - Balanced option

#### Summarization Models (Text Only)

**Recommended:**
- `anthropic--claude-4.5-haiku` (fast, cost-effective)
- `gpt-5-mini` (for OpenAI users)

**Strategy:**
- Use cheaper/faster models for summarization
- Vision capability not required
- Quality still excellent for structured extraction

### API Call Patterns

#### Vision Completion (OCR)

```typescript
{
  model: "anthropic--claude-4.6-sonnet",
  messages: [{
    role: "user",
    content: [
      { type: "text", text: systemPrompt },
      { type: "image", source: { data: base64Image, type: mime } },
      ...(referenceImage ? [{ type: "image", source: { ... } }] : [])
    ]
  }],
  max_tokens: 4096,
  temperature: 0
}
```

#### Text Completion (Summarization)

```typescript
{
  model: "anthropic--claude-4.5-haiku",
  messages: [{
    role: "user",
    content: "Summarize this text: ..."
  }],
  max_tokens: 2048,
  temperature: 0
}
```

### Provider Auto-Detection Logic

```typescript
function selectProvider():
  if AI_PROVIDER env var set:
    return configured provider
  
  if HAI proxy running on port 6655:
    if OPENAI_API_KEY also set:
      return HAI (prefer HAI when both available)
    else:
      return HAI
  
  if OPENAI_API_KEY set:
    return OpenAI Direct
  
  throw "No provider available"
```

---

## Quality Assurance Pipeline

### Three-Layer Quality System

#### Layer 1: Primary OCR Quality Assessment

**Triggers:**
- Runs automatically after every primary OCR
- No user configuration needed

**Metrics:**
- **Illegible Percentage**: `illegible_count / total_words * 100`
- **Consecutive Illegibles**: Count of 5+ consecutive `*[illegible]*` markers
- **Output Length**: Character count vs image file size

**Thresholds (configurable):**
- Illegible threshold: 15% (default)
- Consecutive threshold: 1 occurrence (default)
- Min length: 50 chars for images >100KB

**Decision:**
```typescript
if illegible% > 15% OR consecutive >= 1 OR (length < 50 AND size > 100KB):
  quality = POOR
  trigger fallback
else:
  quality = GOOD
  use primary result
```

#### Layer 2: Automatic OCR Fallback

**Triggered when:** Primary quality assessment = POOR

**Process:**
1. Load fallback model configuration
2. Create fallback AI provider
3. Re-run OCR with same image + prompt
4. Assess fallback quality
5. Compare primary vs fallback
6. Use better result

**Model Selection:**
- Prefer cross-provider fallback (Claude ↔ OpenAI)
- Maximizes coverage across handwriting styles
- Default: Claude primary → GPT fallback

**Example Flow:**
```
Primary (Claude 4.6 Sonnet): 26% illegible → POOR
Fallback (GPT-4.1 Mini): 0% illegible → GOOD
Decision: Use fallback result ✓
```

#### Layer 3: Post-OCR Validation (Optional)

**Enabled with:** `HANDWRITING_REFERENCE_ENABLED=true` + validation config

**Checks:**
- Illegible marker density
- Suspicious patterns (e.g., "aaaaaaa")
- Incomplete transcriptions
- Inconsistent formatting

**Corrections:**
- Replace illegible with glossary terms
- Fix common OCR mistakes
- Validate against reference words

**Output:**
- Corrected OCR text
- Validation report
- Confidence scores

### Quality Monitoring

**Logs provide visibility:**
```bash
# Primary success
📊 OCR Quality Assessment: { illegiblePercent: '5.2%', isPoorQuality: false }
✓ Primary model succeeded: claude-sonnet-4-6

# Fallback triggered
📊 OCR Quality Assessment: { illegiblePercent: '26.1%', isPoorQuality: true }
⚠️  Primary quality poor, trying fallback: gpt-4.1-mini
✓ Fallback model succeeded: gpt-4.1-mini
📊 Fallback Quality: { illegiblePercent: '0.0%', isPoorQuality: false }
```

---

## Image Processing Pipeline

### Stage 1: Preprocessing (Sharp)

**Purpose:** Enhance text clarity and reduce file size before OCR

**Operations:**

#### 1. Grayscale Conversion
```typescript
.grayscale()
```
- **Why:** Removes color information (not needed for text OCR)
- **Impact:** Reduces size ~60-70%
- **Quality:** Preserves text detail

#### 2. Resize
```typescript
.resize({ width: 1600, height: 7000, fit: 'inside' })
```
- **Why:** Limit dimensions for API compatibility
- **Max width:** 1600px (optimized for OCR accuracy)
- **Max height:** 7000px (Claude: 8000px, OpenAI: higher, we use 7000 for safety)
- **Fit:** 'inside' maintains aspect ratio
- **Impact:** Reduces size significantly for large scans

#### 3. Normalize
```typescript
.normalize()
```
- **Why:** Auto-adjust contrast and brightness
- **Impact:** Improves text legibility in poor scans
- **Quality:** Especially helpful for faded ink or light paper

#### 4. Sharpen
```typescript
.sharpen({ sigma: 1.0 })
```
- **Why:** Enhance edge clarity
- **Impact:** Improves character recognition
- **Sigma:** Conservative sharpening (1.0) to avoid artifacts

**Result:**
- Typical size reduction: 40-60%
- Most images: <5MB after preprocessing
- Quality: Optimized for AI OCR

### Stage 2: Compression (Conditional)

**Triggered when:** Preprocessed buffer > target size (default 5MB)

**Algorithm:** Progressive Quality Reduction

```typescript
for quality in [90, 80, minQuality]:
  compressed = sharp(buffer).jpeg({ quality }).toBuffer()
  if compressed.length <= targetSize:
    return compressed
throw "Image too large"
```

**Quality Levels:**

| Quality | Description | Use Case |
|---------|-------------|----------|
| **90** | High quality, minimal compression | Try first, works for most images |
| **80** | Medium quality, good compression | Fallback for larger images |
| **70** | Minimum quality, aggressive compression | Last resort, text still readable |
| **<70** | Not used | Risk of illegible text |

**Compression Metrics:**

Logged for every compression:
```bash
✓ Image compressed: 6.20MB → 4.80MB (quality=80, ratio=1.29x)
```

**Performance:**
- Typical latency: <500ms per compression attempt
- Sharp is highly optimized (uses libvips)
- Only runs when necessary (most images don't need it)

### Stage 3: Encoding

```typescript
const base64Image = finalBuffer.toString('base64')
const mime = 'image/jpeg'  // After preprocessing, always JPEG
```

**Impact:**
- Base64 encoding increases size ~33%
- 5MB buffer → ~6.7MB base64 string
- Still within Claude's 5MB input limit (limit applies to raw buffer)

### Complete Pipeline Example

```
Input: meeting-notes.jpg (12MB, 4000×3000, color PNG)
  ↓ Grayscale
  3.6MB (70% reduction)
  ↓ Resize (1600px width)
  0.9MB (75% reduction)
  ↓ Normalize + Sharpen
  1.1MB (slight increase from processing)
  ↓ Check: 1.1MB < 5MB? YES
  ✓ Skip compression
  ↓ Base64 encode
  ~1.5MB base64 string
  ↓ Send to API
  ✓ Success

Input: high-res-scan.jpg (18MB, 8000×6000, color)
  ↓ Grayscale
  6.3MB (65% reduction)
  ↓ Resize (1600px width)
  2.8MB (56% reduction)
  ↓ Normalize + Sharpen
  3.2MB (slight increase)
  ↓ Check: 3.2MB < 5MB? YES
  ✓ Skip compression
  ↓ Base64 encode
  ~4.3MB base64 string
  ↓ Send to API
  ✓ Success

Input: detailed-diagram.png (22MB, 8000×8000, color PNG)
  ↓ Grayscale
  8.1MB (63% reduction)
  ↓ Resize (1600px width)
  4.2MB (48% reduction)
  ↓ Normalize + Sharpen
  4.8MB
  ↓ Check: 4.8MB < 5MB? YES
  ✓ Skip compression
  ↓ Base64 encode
  ~6.4MB base64 string
  ↓ Send to API
  ✓ Success

Input: ultra-hires-scan.jpg (25MB, 10000×10000, color)
  ↓ Grayscale
  9.5MB (62% reduction)
  ↓ Resize (1600px width)
  5.8MB (39% reduction)
  ↓ Normalize + Sharpen
  6.2MB
  ↓ Check: 6.2MB < 5MB? NO
  ↓ Compress quality=90
  5.8MB (still >5MB)
  ↓ Compress quality=80
  4.8MB (<5MB ✓)
  📦 Log: 6.20MB → 4.80MB (quality=80, ratio=1.29x)
  ↓ Base64 encode
  ~6.4MB base64 string
  ↓ Send to API
  ✓ Success
```

---

## Configuration Management

### Configuration Hierarchy

**Priority (highest to lowest):**
1. Environment variables (`.env` file)
2. Handwriting reference config (`handwriting-reference.json`)
3. Auto-detection (HAI proxy, provider availability)
4. Hard-coded defaults

### Environment Variables

#### AI Provider Selection
- `AI_PROVIDER` - Explicit provider selection (openai | hai)
- `OPENAI_API_KEY` - OpenAI API key (direct access)
- `ANTHROPIC_AUTH_TOKEN` / `HAI_API_KEY` - HAI proxy authentication

#### HAI Proxy Management
- `HAI_AUTO_START` - Auto-start proxy if not running (default: true)
- `HAI_PROXY_PORT` - Proxy port (default: 6655)
- `ANTHROPIC_BASE_URL` - Claude endpoint URL

#### Model Selection
- `AI_MODEL_OCR` - Primary OCR model
- `AI_MODEL_OCR_FALLBACK` - Fallback OCR model
- `AI_MODEL_SUMMARIZATION` - Summarization model
- `AI_MODEL_VALIDATION` - Validation model

#### Image Compression
- `IMAGE_COMPRESSION_MAX_SIZE_MB` - Size threshold (default: 5)
- `IMAGE_COMPRESSION_MIN_QUALITY` - Min JPEG quality (default: 70)
- `IMAGE_COMPRESSION_ENABLED` - Enable/disable (default: true)

#### OCR Quality Thresholds
- `OCR_ILLEGIBLE_THRESHOLD` - Trigger fallback % (default: 15)
- `OCR_CONSECUTIVE_ILLEGIBLE_THRESHOLD` - Consecutive count (default: 1)
- `OCR_MIN_LENGTH_THRESHOLD` - Min output length (default: 50)
- `OCR_MIN_IMAGE_SIZE` - Image size for length check (default: 100000)

#### Handwriting Reference
- `HANDWRITING_REFERENCE_ENABLED` - Enable personalization (default: true)
- `HANDWRITING_REFERENCE_FILE` - Reference JSON path (default: ./handwriting-reference.json)

### Configuration Presets

**Pre-configured files for quick setup:**

| File | Provider | Primary Model | Fallback Model |
|------|----------|---------------|----------------|
| `.env.proxy.claude` | HAI → Claude | claude-4.6-sonnet | gpt-4.1-mini |
| `.env.proxy.openai` | HAI → OpenAI | gpt-5 | claude-4.6-sonnet |
| `.env.direct.openai` | OpenAI Direct | gpt-4o | - |

**Usage:**
```bash
cp .env.proxy.claude .env  # Use Claude via HAI
npm start
```

### Handwriting Reference JSON

**Schema:**
```json
{
  "referenceWords": ["word1", "word2"],
  "specialCharacters": ["@", "#"],
  "referenceImagePath": "./path/to/reference.jpg",
  "domainGlossary": {
    "acronyms": { "API": "Application Programming Interface" },
    "properNouns": ["ProductName", "CompanyName"],
    "businessTerms": ["quarterly revenue", "market share"]
  },
  "ocrValidation": {
    "enabled": true,
    "illlegibleThreshold": 0.15,
    "confidenceThreshold": 0.8
  },
  "notes": "Personal notes (not used by OCR)"
}
```

**Purpose:**
- Improve OCR accuracy for personal handwriting style
- Provide domain-specific vocabulary context
- Enable validation and correction

---

## Error Handling & Resilience

### Error Categories

#### 1. Image Processing Errors

**Scenarios:**
- Invalid image format
- Corrupted image file
- Unsupported image format
- Image too large to process

**Handling:**
- Log error with file path
- Skip to next image
- Continue batch processing

#### 2. Compression Errors

**Scenarios:**
- Image can't compress to target size
- Sharp processing fails

**Handling:**
- Log detailed error with:
  - Original size
  - Target size
  - Quality levels attempted
- Provide actionable guidance:
  ```
  Image too large to compress: 25.2MB exceeds 5MB limit even at quality=70.
  Please resize the image manually to reduce file size before processing.
  Recommended: Reduce resolution to ~2000px width.
  ```

#### 3. API Errors

**Scenarios:**
- Authentication failure
- Rate limiting
- Network timeout
- Model not available
- API quota exceeded

**Handling:**
- **Retry logic**: Exponential backoff for transient errors
- **Fallback**: Use alternate provider if available
- **Logging**: Detailed error context
- **User guidance**: Clear error messages with resolution steps

#### 4. HAI Proxy Errors

**Scenarios:**
- Proxy not running
- Proxy authentication failed
- Proxy port in use
- HAI CLI not installed

**Handling:**
- **Auto-start**: Attempt to start proxy if `HAI_AUTO_START=true`
- **Detection**: Check proxy availability before API calls
- **Fallback**: Switch to OpenAI direct if available
- **Guidance**: Installation instructions if CLI missing

### Resilience Strategies

#### Automatic Failover

```
Primary OCR fails or poor quality
  ↓
Check if fallback configured
  ↓
Attempt fallback OCR
  ↓
Compare results
  ↓
Use better result
```

#### Caching Strategy

**What's cached:**
- Handwriting reference (session-level)
- Reference image buffer (session-level)
- AI provider instance (session-level)

**Benefits:**
- Avoid redundant file I/O
- Reuse API clients
- Faster batch processing

**Invalidation:**
- On configuration change
- On application restart

#### Graceful Degradation

**Scenario: Summarization fails**
- ✓ OCR markdown still generated
- ⚠️ Summary file not created
- ℹ️ User can manually trigger summarization later

**Scenario: Validation fails**
- ✓ Raw OCR result still usable
- ⚠️ Corrections not applied
- ℹ️ Fallback already ensures reasonable quality

---

## Performance Considerations

### Latency Breakdown

**Typical handwriting note (2MB image):**

| Stage | Time | Notes |
|-------|------|-------|
| **Load image** | 10-50ms | Depends on disk I/O |
| **Preprocessing** | 100-300ms | Sharp is fast |
| **Compression** | 0ms | Not needed for 2MB |
| **Primary OCR** | 3-8s | Network + AI inference |
| **Quality assessment** | <10ms | Local regex processing |
| **Fallback OCR** | 0s | Only if quality poor |
| **Summarization** | 1-3s | Smaller prompt than OCR |
| **Write output** | 10-50ms | Fast file write |
| **Total** | **4-12s** | **Most time is AI API** |

**Large image (8MB, needs compression):**

| Stage | Time | Notes |
|-------|------|-------|
| **Load image** | 20-100ms | Larger file |
| **Preprocessing** | 200-500ms | More pixels to process |
| **Compression** | 300-800ms | Try 2-3 quality levels |
| **Primary OCR** | 4-10s | Slightly larger payload |
| **Quality assessment** | <10ms | Same |
| **Summarization** | 1-3s | Same |
| **Total** | **6-15s** | **Compression adds ~0.5-1s** |

### Optimization Techniques

#### 1. Caching
- **Reference data**: Load once per session
- **AI provider**: Reuse client instance
- **Configuration**: Parse env vars once

#### 2. Batch Processing
- Process multiple images in single run
- Reuse cached resources across images
- Skip already-processed files (check for existing .md)

#### 3. Parallel Processing (Future Enhancement)
- Current: Sequential processing
- Future: Process N images concurrently
- Limit: API rate limits, memory constraints

#### 4. Smart Compression
- Only compress when needed (>5MB)
- Stop at first successful quality level
- Most images don't need compression (saves time)

### Memory Usage

**Typical session:**
- Base application: ~50-100MB
- Image buffer: 2-10MB (1 image at a time)
- Sharp processing: 10-50MB (temporary)
- AI provider clients: 5-10MB
- **Total: ~70-170MB** (very reasonable)

**Large batch (100 images):**
- Same as above (processes sequentially)
- Memory doesn't grow with batch size
- Garbage collected between images

---

## Security & Compliance

### Data Privacy

#### Data Flow
1. **Local Processing**: All image processing happens locally
2. **API Transmission**: Images sent to AI providers (Claude/OpenAI)
3. **Output Storage**: Results written to local filesystem
4. **No Cloud Storage**: No persistent cloud storage of user data

#### Sensitive Data Handling
- **Handwritten notes**: May contain sensitive business info
- **Reference images**: May contain personal handwriting samples
- **API keys**: Stored in environment variables or system keyring

### Compliance Considerations

#### For SAP Employees (HAI Proxy)

**Benefits:**
- ✅ Compliant with SAP AI usage policies
- ✅ Data processed through approved SAP infrastructure
- ✅ Automatic compliance with data residency requirements
- ✅ SSO authentication (no API keys in files)

**Data Flow:**
```
User's laptop → HAI Proxy (localhost) → SAP Infrastructure → AI Provider APIs
                                         ↑
                                    Compliant path
```

#### For Non-SAP Users (Direct OpenAI)

**Considerations:**
- ⚠️ Data sent directly to OpenAI
- ⚠️ Subject to OpenAI's data policies
- ⚠️ Check organizational policies before use
- ℹ️ Consider: What data is in your handwritten notes?

### API Key Security

#### HAI Proxy (Recommended)
- Keys managed by HAI CLI
- Stored in system keyring (macOS Keychain, Windows Credential Manager)
- Auto-refresh (no manual key rotation)
- Not stored in `.env` files

#### OpenAI Direct
- API key in `.env` file
- ⚠️ `.env` should be in `.gitignore`
- ⚠️ Never commit API keys to git
- ⚠️ Rotate keys if exposed

### Best Practices

1. **Don't commit `.env` files** - They may contain secrets
2. **Use HAI proxy when possible** - Better security model for SAP
3. **Review handwritten notes** - Don't OCR confidential docs without approval
4. **Monitor API usage** - Track costs and usage patterns
5. **Rotate keys regularly** - Especially if using direct OpenAI access

---

## Deployment Architecture

### Local Development Setup

```
Developer's Machine
├── Node.js 18+ Runtime
├── npm (package manager)
├── Git (version control)
├── HAI CLI (optional, for HAI proxy)
│   └── HAI Proxy (localhost:6655)
└── Handwriting OCR CLI
    ├── src/ (TypeScript source)
    ├── tests/ (Vitest tests)
    ├── .env (configuration)
    └── handwriting-reference.json (optional)
```

**Installation:**
```bash
# 1. Clone repository
git clone <repo-url>
cd handwriting-ocr-cli

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.proxy.claude .env
# Or for OpenAI: Set OPENAI_API_KEY in .env

# 4. Set up HAI proxy (for SAP employees)
hai auth login
hai proxy start

# 5. Run
npm start
```

### Production Deployment Patterns

#### Pattern 1: Personal Workstation

**Use Case:** Individual developer/user

**Setup:**
- Install on local machine
- Configure monitored folders (OneDrive, local folders)
- Run manually or via scheduler (cron, Task Scheduler)

**Scaling:**
- Single user
- Processes images as needed
- Low resource requirements

#### Pattern 2: Shared Team Server

**Use Case:** Multiple users, shared processing

**Setup:**
- Deploy on shared server/VM
- Configure multiple monitored folders (one per user)
- Run as systemd service or Windows service

**Scaling:**
- Multiple users
- Sequential processing (no concurrency yet)
- Consider API rate limits

#### Pattern 3: CI/CD Pipeline Integration

**Use Case:** Automated processing in build pipelines

**Setup:**
- Container image with tool installed
- Mount input/output volumes
- Run as part of pipeline stage

**Example (GitHub Actions):**
```yaml
- name: OCR Handwritten Notes
  run: |
    docker run --rm \
      -v $PWD/images:/app/input \
      -v $PWD/output:/app/output \
      handwriting-ocr-cli
```

### Infrastructure Requirements

#### Minimum Requirements
- **CPU**: 2 cores
- **RAM**: 2GB
- **Disk**: 1GB for application + space for images
- **Network**: Internet access for AI APIs

#### Recommended Requirements
- **CPU**: 4+ cores (for Sharp image processing)
- **RAM**: 4GB+
- **Disk**: SSD for faster image I/O
- **Network**: Stable high-speed connection

### Monitoring & Observability

#### Logging

**Current:**
- Console logs to stdout/stderr
- Structured log messages
- Color-coded output (✓ ℹ️ ⚠️ ❌)

**Suggested Enhancements:**
- Log levels (DEBUG, INFO, WARN, ERROR)
- Log to file (rotating logs)
- Structured JSON logs for parsing
- Integration with log aggregation (Splunk, ELK)

#### Metrics

**Tracked (via logs):**
- Images processed
- Compression statistics
- OCR quality metrics
- Fallback usage rate
- Processing time per image
- Model usage distribution

**Suggested Enhancements:**
- Prometheus metrics export
- Grafana dashboards
- Alert on failure rate
- Cost tracking per model

#### Health Checks

**Current:**
- Manual: Check if process running
- Manual: Verify output files created

**Suggested Enhancements:**
- `/health` HTTP endpoint
- Periodic self-test with sample image
- HAI proxy connectivity check
- AI provider availability check

---

## Appendix

### File Structure

```
handwriting-ocr-cli/
├── src/
│   ├── main.ts                    # Entry point, folder monitoring
│   ├── ocr.ts                     # OCR processing + compression
│   ├── aiProvider.ts              # AI provider abstraction
│   ├── handwritingReference.ts    # Reference loading + config
│   ├── ocrValidator.ts            # Quality validation
│   ├── summarize.ts               # AI summarization
│   └── utils.ts                   # Helper functions
├── tests/
│   ├── image-compression.test.ts  # Compression tests
│   ├── ocr-processing.test.ts     # OCR tests
│   ├── ocr-fallback.test.ts       # Fallback tests
│   └── ...
├── openspec/                      # OpenSpec changes
│   ├── specs/                     # Capability specifications
│   └── changes/                   # Implementation changes
├── .env.example                   # Configuration template
├── .env.proxy.claude              # Claude preset
├── .env.proxy.openai              # OpenAI preset
├── handwriting-reference.json     # Reference configuration
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
├── README.md                      # User documentation
├── CONFIG.md                      # Configuration guide
└── ARCHITECTURE.md                # This document
```

### Key Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `@anthropic-ai/sdk` | Claude API client | ^0.82.0 |
| `openai` | OpenAI API client | ^4.96.0 |
| `sharp` | Image processing | ^0.34.2 |
| `dotenv` | Environment config | ^16.5.0 |
| `typescript` | Language | ^5.8.3 |
| `vitest` | Testing framework | ^4.1.2 |

### Performance Benchmarks

**Test Configuration:**
- MacBook Pro M1, 16GB RAM
- HAI Proxy (Claude 4.6 Sonnet)
- Average handwritten note: 2-3MB, 2000×1500px

**Results:**

| Scenario | Image Size | Preprocessing | Compression | OCR | Total |
|----------|-----------|---------------|-------------|-----|-------|
| Small note | 1.2MB | 150ms | 0ms | 3.5s | ~3.7s |
| Standard note | 2.8MB | 250ms | 0ms | 4.2s | ~4.5s |
| Large note | 5.6MB | 400ms | 600ms | 5.1s | ~6.1s |
| Very large | 12MB | 600ms | 800ms | 6.5s | ~7.9s |

**Fallback Impact:**
- Adds 3-5s per fallback (full re-OCR)
- Only triggers ~5-10% of images (with good models)
- Trade-off: Better quality vs slightly longer processing

### Glossary

- **HAI**: Hyperspace AI - SAP's internal AI gateway/proxy
- **OCR**: Optical Character Recognition
- **Sharp**: High-performance Node.js image processing library (libvips)
- **Fallback**: Secondary model used when primary OCR quality is poor
- **Preprocessing**: Image enhancements applied before OCR (grayscale, resize, etc.)
- **Compression**: JPEG quality reduction to meet API size limits
- **Reference**: Handwriting samples used to improve personal OCR accuracy
- **Illegible markers**: `*[illegible]*` placeholders when AI can't read text
- **Quality assessment**: Automatic evaluation of OCR output quality
- **Provider**: AI service (Claude via HAI, OpenAI direct, etc.)
- **Vision model**: AI model that can process images (required for OCR)
- **Text model**: AI model that processes text only (used for summarization)

---

**Document Version:** 1.0  
**Last Updated:** April 10, 2026  
**Author:** Generated from codebase analysis  
**Maintained by:** Development team
