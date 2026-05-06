# Handwritten OCR CLI

Automated OCR tool for converting handwritten notes to markdown with AI-powered summarization.

## Features

- **Handwriting OCR**: Converts handwritten notes (images) to structured markdown
- **Smart Layout Detection**: Automatically detects tables vs. freeform notes
- **AI Summarization**: Generates structured summaries with action items, learnings, and decisions
- **Handwriting Reference**: Personalized character recognition based on your writing style
- **Batch Processing**: Processes multiple images in monitored folders
- **Automatic Image Compression**: Handles large images (>5MB) with quality-preserving compression
- **Automatic OCR Fallback**: Retries with alternate model when primary OCR quality is poor

---

## 🚀 Quick Start Guide

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure AI Provider

This tool supports multiple AI providers for OCR and summarization:

#### Option A: HAI Proxy (Recommended for SAP Employees)

✅ **Zero cost** - Uses corporate AI infrastructure  
✅ **Better OCR** - Claude 3.5 Sonnet excels at handwriting  
✅ **Compliant** - Meets SAP AI usage policies  
✅ **Auto-start** - Proxy starts automatically when needed  

**Prerequisites:**

Choose **one** of the following setup methods:

**Method 1: HAI CLI (Recommended)**
1. Install HAI CLI: [Installation Guide](https://ai-docs.portal.hyperspace.tools.sap/llm-proxy/recipes/cline/)
2. Authenticate: `hai auth login`
3. Start proxy: `hai proxy start --headless` (or enable auto-start in config)

**Method 2: HAI Desktop Application**
1. Install HAI Desktop App (if you don't have the CLI)
2. Open the HAI app and start the proxy
3. **Get your API key from the HAI app UI** (usually in Settings or API section)
4. **Copy the API key to your `.env` file:**
   ```env
   HAI_API_KEY=your-api-key-from-hai-app
   ```
   
   > **Note:** When using the HAI desktop app, you **must** manually set `HAI_API_KEY` in your `.env` file. The CLI auto-configures this, but the desktop app requires manual configuration.

**Configuration:**

For HAI CLI (auto-configured):
```env
AI_PROVIDER=hai
HAI_AUTO_START=true                # Auto-start proxy if not running
HAI_PROXY_PORT=6655               # Default port

# Optional: Customize models (HAI auto-routes based on model name)
AI_MODEL_OCR=gpt-4.1                      # ⭐ Recommended (best value)
# AI_MODEL_OCR=anthropic--claude-4.6-sonnet  # Alternative: highest accuracy
AI_MODEL_SUMMARIZATION=anthropic--claude-4.5-haiku
AI_MODEL_VALIDATION=anthropic--claude-4.5-haiku

# Automatic Fallback OCR (Recommended)
# Automatically retries with a different model if OCR quality is poor
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini  # Cross-provider fallback
```

For HAI Desktop App (requires manual API key):
```env
AI_PROVIDER=hai
HAI_API_KEY=your-api-key-from-hai-app  # ⚠️ REQUIRED for desktop app
HAI_AUTO_START=false               # Desktop app manages proxy lifecycle
HAI_PROXY_PORT=6655               # Default port

# Optional: Customize models
AI_MODEL_OCR=gpt-4.1                # ⭐ Recommended (best value)
# AI_MODEL_OCR=anthropic--claude-4.6-sonnet  # Alternative: highest accuracy
AI_MODEL_SUMMARIZATION=anthropic--claude-4.5-haiku
AI_MODEL_VALIDATION=anthropic--claude-4.5-haiku

# Automatic Fallback OCR (Recommended)
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini  # Cross-provider fallback
```

#### Option B: OpenAI Direct (For Non-SAP Users)

**Configuration:**
Create `.env` file:

```env
OPENAI_API_KEY=your_openai_api_key_here
AI_PROVIDER=openai  # Optional, will auto-detect from API key

# Optional: Customize models
AI_MODEL_OCR=gpt-4.1        # ⭐ Recommended (90.8% accuracy, best value)
# Other options:
# AI_MODEL_OCR=gpt-4o       # If available via OpenAI direct
AI_MODEL_SUMMARIZATION=gpt-4.1-mini
AI_MODEL_VALIDATION=gpt-4.1-mini
AI_MODEL_SUMMARIZATION=gpt-4o-mini
AI_MODEL_VALIDATION=gpt-4o-mini

# Automatic Fallback OCR (Recommended)
AI_MODEL_OCR_FALLBACK=anthropic--claude-4.6-sonnet  # Cross-provider fallback
```

Get your API key from: https://platform.openai.com/api-keys

#### Option C: HAI Proxy with OpenAI Primary

Use OpenAI models as primary through HAI proxy:

```env
AI_PROVIDER=hai
AI_MODEL_OCR=gpt-5                    # OpenAI model
AI_MODEL_OCR_FALLBACK=anthropic--claude-4.6-sonnet  # Claude fallback
# HAI proxy will be auto-started
```

### Troubleshooting AI Provider

**"ANTHROPIC_AUTH_TOKEN or HAI_API_KEY is required for HAI provider"**
- **Using HAI CLI:** Token is auto-configured. Ensure you've run `hai auth login`
- **Using HAI Desktop App:** Copy the API key from the HAI app settings and add to `.env`:
  ```env
  HAI_API_KEY=your-api-key-from-hai-app
  ```
- **Manual proxy start:** If auto-start disabled, run `hai proxy start` before using the tool

**"HAI CLI not found in PATH"**
- Install HAI CLI: [Installation Guide](https://ai-docs.portal.hyperspace.tools.sap/llm-proxy/recipes/cline/)
- Restart your terminal after installation
- Or use HAI Desktop App instead (requires manual `HAI_API_KEY` configuration)

**"HAI proxy is not running"**
- Auto-start is enabled by default for CLI users
- Manual start: `hai proxy start`
- Check status: `lsof -i :6655`
- Disable auto-start: `HAI_AUTO_START=false` in `.env`
- For desktop app users: Start proxy from the HAI application

**"OPENAI_API_KEY is required"**
- For OpenAI direct, set `OPENAI_API_KEY` in `.env`
- For HAI proxy with CLI, the key is managed automatically
- For HAI proxy with desktop app, set `HAI_API_KEY` in `.env`

### Step 3: Configure Your OpenAI API Key

**(Skip this if using HAI Proxy)**

Create or edit `.env` file in the root directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

Get your API key from: https://platform.openai.com/api-keys

### Step 4: Configure Monitored Folders

Edit [src/main.ts](src/main.ts) to set which folders contain your handwritten note images:

```typescript
const MONITORED_FOLDERS = [
  path.resolve('/path/to/your/notes/folder'),
];
```

**Example:**
```typescript
const MONITORED_FOLDERS = [
  path.resolve('/Users/yourname/Documents/Notes'),
  path.resolve('/Users/yourname/Dropbox/Meeting Notes'),
];
```

### Step 5: (Optional but Recommended) Set Up Handwriting Reference

To improve OCR accuracy for your specific handwriting, provide a reference sample.

#### Option A: Use Image Reference (Most Accurate)

1. **Write a reference sheet on blank paper:**
   ```
   Uppercase: A B C D E F G H I J K L M N O P Q R S T U V W X Y Z

   Lowercase: a b c d e f g h i j k l m n o p q r s t u v w x y z

   Numbers: 0 1 2 3 4 5 6 7 8 9

   Pangram: The quick brown fox jumps over the lazy dog

   Common words: Meeting Notes Important Action Calendar Project
   ```

2. **Take a clear photo:**
   - Use good lighting (natural daylight is best)
   - Hold camera directly above paper
   - Ensure text is in focus
   - Avoid shadows and glare
   - Save high resolution (1200px+ wide)

3. **Save the photo:**
   - Save it as: `./handwriting-samples/reference-sheet.jpg` or `.jpeg`

4. **Update** [handwriting-reference.json](handwriting-reference.json) with the correct path:
   ```json
   {
     "referenceImagePath": "./handwriting-samples/reference-sheet.jpeg"
   }
   ```

#### Option B: Use Text Reference (Simpler but Less Effective)

Edit [handwriting-reference.json](handwriting-reference.json):

```json
{
  "referenceWords": [
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "abcdefghijklmnopqrstuvwxyz",
    "The quick brown fox jumps over the lazy dog",
    "0123456789",
    "Apple", "Beautiful", "Calendar", "Important", "Meeting", "Notes"
  ]
}
```

The system will use these as text context (but won't see your actual handwriting).

#### Option C: Skip Reference (Works Fine Without)

Delete `handwriting-reference.json` or set in `.env`:
```env
HANDWRITING_REFERENCE_ENABLED=false
```

The OCR will work normally without personalized handwriting reference.

### Step 6: Run the Tool

```bash
npm start
```

The tool will:
1. ✓ Load your handwriting reference (if configured)
2. ✓ Scan your monitored folders for images
3. ✓ Process any new images (skips already-processed ones)
4. ✓ Generate markdown files with OCR text and summaries

---

## 📄 What Gets Created

For each image (e.g., `meeting-notes.jpg`), the tool creates:

### 1. `meeting-notes.md` - Raw OCR Transcription
- Exact transcription of your handwritten notes
- Preserves layout, indentation, bullets, tables
- Links to summary and original image

### 2. `meeting-notes - Summary and Actions.md` - AI Summary
- **Summary**: 3-5 sentence overview of key themes
- **Action Items**: Extracted tasks (prefixed with "AI:")
- **Key Learnings**: Important insights
- **Key Decisions**: Decisions made during meeting
- **Tags**: Contextual hashtags for organization

**Skip summarization:** Add `_nosum` to filename (e.g., `notes_nosum.jpg`) to skip summary generation.

---

## ⚙️ Configuration Reference

### Automatic OCR Fallback

**Improve OCR accuracy across different handwriting styles** by configuring automatic fallback to a secondary model when the primary produces poor quality results.

#### How It Works

1. **Primary OCR** runs with your configured model (e.g., Claude 4.6 Sonnet)
2. **Quality Assessment** checks for poor quality indicators:
   - High percentage of illegible markers (>15%)
   - Consecutive illegible markers (5+ in a row)
   - Very short output for large images (<50 chars for >100KB images)
3. **Automatic Fallback** retries with a different model if quality is poor
4. **Best Result** is returned automatically

**Real-world example:**
- Primary (Claude 4.6 Sonnet): 26% illegible → 112 `*[illegible]*` markers
- Fallback (GPT-4.1 Mini): 0% illegible → Clean, readable output ✓

#### Configuration

Set `AI_MODEL_OCR_FALLBACK` in your `.env` file:

```env
# Primary OCR model
AI_MODEL_OCR=anthropic--claude-4.6-sonnet

# Fallback model (recommended: different provider than primary)
AI_MODEL_OCR_FALLBACK=gpt-4.1-mini  # Cross-provider fallback
```

**Requirements:**
- HAI proxy must be running for cross-provider fallback (Claude ↔ OpenAI)
- Both providers accessible through same proxy (default setup)
- No additional configuration needed - automatic provider switching

#### Recommended Model Combinations

Based on comprehensive testing across handwriting styles:

| Primary Model | Fallback Model | Best For |
|--------------|----------------|----------|
| Claude 4.6 Sonnet | GPT-4.1 Mini | **Recommended** - Best overall coverage |
| GPT-4o | Claude 4.6 Sonnet | OpenAI users wanting Claude fallback |
| Claude 4.6 Opus | GPT-4.1 Mini | High-accuracy primary with fast fallback |

**Why cross-provider?** Different AI models excel at different handwriting styles. Claude 4.6 Sonnet achieves 100% accuracy on business notes but struggles with technical planning docs, while GPT-4.1 Mini performs well where Claude struggles.

#### Quality Thresholds (Optional)

Fine-tune when fallback triggers by setting these environment variables:

```env
# Trigger fallback if >15% of words are illegible (default: 15)
OCR_ILLEGIBLE_THRESHOLD=15

# Trigger fallback if 5+ consecutive illegible markers found (default: 1 occurrence)
OCR_CONSECUTIVE_ILLEGIBLE_THRESHOLD=1

# Trigger fallback if output <50 chars for images >100KB (default: 50)
OCR_MIN_LENGTH_THRESHOLD=50

# Minimum image size to check length (default: 100000 bytes = ~100KB)
OCR_MIN_IMAGE_SIZE=100000
```

**Tuning guidance:**
- **Lower threshold (10-15%)**: More aggressive, fewer poor results slip through
- **Higher threshold (20-30%)**: More conservative, fallback only on severe quality issues
- **Recommended**: Keep default 15% based on production testing

#### Disable Fallback

To use only the primary model:

```env
AI_MODEL_OCR_FALLBACK=none
# or
AI_MODEL_OCR_FALLBACK=""
```

#### Monitoring Fallback Usage

When fallback triggers, you'll see log output:

```
📊 OCR Quality Assessment: { illegiblePercent: '26.1%', ... isPoorQuality: true }
⚠️  Primary quality poor (High illegible percentage: 26.1% (threshold: 15%)), trying fallback: gpt-4.1-mini
✓ Fallback model succeeded: gpt-4.1-mini-2025-04-14
📊 Fallback Quality Assessment: { illegiblePercent: '0.0%', ... isPoorQuality: false }
```

When primary succeeds without fallback:

```
📊 OCR Quality Assessment: { illegiblePercent: '5.2%', ... isPoorQuality: false }
✓ Primary model succeeded: claude-sonnet-4-6
```

### Automatic Image Compression

**Handle large images automatically** by enabling compression for images that exceed Claude 4.6 Sonnet's 5MB limit.

#### How It Works

Claude 4.6 Sonnet has a 5MB limit for image inputs. High-resolution scanned notes often exceed this (6-15MB). The system automatically compresses oversized images using progressive quality reduction while preserving text readability:

1. **Check size after preprocessing** - Most images will be <5MB and won't need compression
2. **Progressive quality reduction** - Try quality=90, then 80, then 70 (minimum)
3. **Stop when target met** - Use the highest quality that fits within 5MB
4. **Fail with guidance** - If even quality=70 exceeds 5MB, provide manual resize instructions

**Real-world example:**
- Original preprocessed: 6.2MB
- Compressed at quality=80: 4.8MB ✓
- Compression ratio: 1.29x

#### Configuration

Image compression is **enabled by default** with sensible defaults:

```env
# Optional - defaults work for most cases
IMAGE_COMPRESSION_MAX_SIZE_MB=5        # Claude 4.6 Sonnet's limit
IMAGE_COMPRESSION_MIN_QUALITY=70       # Minimum acceptable quality for text
IMAGE_COMPRESSION_ENABLED=true         # Enable automatic compression
```

**Tuning guidance:**
- **Lower min quality (60-69)**: More aggressive compression, higher risk of illegible text
- **Higher min quality (75-85)**: Less compression, may not meet 5MB limit
- **Recommended**: Keep default quality=70 (tested for text readability)

#### Disable Compression

To disable automatic compression (images >5MB will fail):

```env
IMAGE_COMPRESSION_ENABLED=false
```

#### Monitoring Compression

When compression occurs, you'll see log output:

```
✓ Image compressed: 6.20MB → 4.80MB (quality=80, ratio=1.29x)
```

When compression isn't needed:

```
✓ Primary model succeeded: claude-sonnet-4-6
📊 OCR Quality Assessment: { illegiblePercent: '5.2%', ... isPoorQuality: false }
```

**Troubleshooting:** If you see "Image too large to compress" errors:
1. Check original image resolution (8000×8000 pixels is reasonable limit)
2. Consider manually resizing very large scans before processing
3. Use image editing software to reduce resolution to ~2000px width

### Quick Configuration Presets

For testing different AI providers, use the pre-configured files:

```bash
# Claude via HAI Proxy (recommended)
cp .env.proxy.claude .env

# OpenAI via HAI Proxy
cp .env.proxy.openai .env

# OpenAI Direct (requires API key)
cp .env.direct.openai .env
```

See [CONFIG.md](CONFIG.md) for detailed configuration guide and [tests/MODELS.md](tests/MODELS.md) for complete model reference.

### Environment Variables (.env)

All AI provider configuration is managed through environment variables in the `.env` file. See [.env.example](.env.example) for a complete reference with all available options and their descriptions.

#### AI Provider Selection

**`AI_PROVIDER`** - Choose which AI service to use
- `openai` - Use OpenAI directly (requires OPENAI_API_KEY)
- `hai` - Use HAI proxy (automatically routes to Claude or OpenAI based on model)
- *(not set)* - Auto-detect (HAI proxy if running, else OpenAI)

#### OpenAI Configuration

**`OPENAI_API_KEY`** - Your OpenAI API key
- Get from: https://platform.openai.com/api-keys
- Format: `sk-proj-...` or `sk-...`
- Required when using OpenAI direct

#### HAI Proxy Configuration

**`HAI_AUTO_START`** - Auto-start HAI proxy if not running
- `true` (default) - Automatically launch HAI proxy when needed
- `false` - Require manual start
- Requires HAI CLI: https://ai-docs.portal.hyperspace.tools.sap/llm-proxy/

**`HAI_PROXY_PORT`** - Port for HAI proxy
- Default: `6655`
- Must match HAI proxy configuration

**`ANTHROPIC_BASE_URL`** - Base URL for Claude API
- Default: `http://localhost:6655/anthropic/`
- Usually doesn't need to be changed

**`ANTHROPIC_AUTH_TOKEN`** / **`HAI_API_KEY`** - Authentication token
- **HAI CLI:** Auto-configured by HAI CLI after `hai auth login`
- **HAI Desktop App:** **Must be set manually** - copy from HAI app settings:
  ```env
  HAI_API_KEY=your-api-key-from-hai-app
  ```
- Both variables work interchangeably (use whichever is set)
- Required only when using `AI_PROVIDER=hai`

#### Model Selection (Optional)

> **📊 Based on OCR Experiments (2026-05-06)**  
> Tested GPT-5, GPT-4.1, Claude 4.6 Sonnet, and Claude 4.5 Sonnet on handwriting samples.  
> **Recommendation**: Use `gpt-4.1` for best value (90.8% accuracy, fast, low cost) or `claude-4.6-sonnet` for highest accuracy (92.2%, 17% more expensive).  
> **Avoid**: `gpt-5` is 2.5x slower than `gpt-4.1` with no accuracy benefit.  
> See [experiment results](experiment-results/model-analysis.md) for details.

**`AI_MODEL_OCR`** - Model for handwriting OCR (requires vision)
- **OpenAI options (via HAI proxy or direct):**
  - `gpt-4.1` - **⭐ Recommended** - Best balance (90.8% accuracy, fast, cheap)
  - `gpt-5-mini` - Efficient model, good for batch processing
  - `gpt-4.1-mini` - Faster, lower cost alternative
  - ⚠️ `gpt-5` - Latest but 2.5x slower than gpt-4.1 with same accuracy (not recommended)
  - Full list: https://platform.openai.com/docs/models
- **Claude options (via HAI proxy):**
  - `anthropic--claude-4.6-sonnet` - **⭐ Highest accuracy** (92.2%, but 17% more expensive)
  - `anthropic--claude-4.5-sonnet` - Previous gen, 91.8% accuracy
  - `anthropic--claude-4.6-opus` - Premium flagship, highest quality
  - `anthropic--claude-4.5-opus` - Previous gen opus
  - `anthropic--claude-4.5-haiku` - Fastest, lower cost
  - `anthropic--claude-4-sonnet` - Older generation
- List all models: Run `/list-available-models` skill or check HAI proxy

**`AI_MODEL_SUMMARIZATION`** - Model for generating summaries
- **OpenAI options:**
  - `gpt-5-mini` - GPT-5 Mini, optimized for speed/cost
  - `gpt-5` - GPT-5, more capable
  - `gpt-4.1-mini` - GPT-4.1 Mini, balanced
  - `gpt-4.1` - GPT-4.1, higher capability
- **Claude options (via HAI proxy):**
  - `anthropic--claude-4.5-haiku` (default) - Fast and cost-effective
  - `anthropic--claude-4.6-sonnet` - Latest Claude 4.6 Sonnet
  - `anthropic--claude-4.5-sonnet` - Claude 4.5 Sonnet, more capable
  - `anthropic--claude-4.6-opus` - Claude 4.6 Opus, highest quality
  - `anthropic--claude-4.5-opus` - Claude 4.5 Opus

**`AI_MODEL_VALIDATION`** - Model for OCR quality validation
- **OpenAI options:**
  - `gpt-5-mini` - Recommended, optimized for validation tasks
  - `gpt-4.1-mini` - Balanced option
  - `gpt-5` - More thorough validation
  - `gpt-4.1` - Higher accuracy
- **Claude via HAI options:**
  - `anthropic--claude-4.5-haiku` (default) - Fast validation
  - `anthropic--claude-4.6-sonnet` - More thorough
  - `anthropic--claude-4.5-sonnet` - Balanced thoroughness

#### Image Compression

**`IMAGE_COMPRESSION_MAX_SIZE_MB`** - Maximum image size before compression
- Default: `5` (Claude 4.6 Sonnet's limit)
- Images larger than this will be automatically compressed
- Adjust for different AI providers (e.g., `20` for OpenAI)

**`IMAGE_COMPRESSION_MIN_QUALITY`** - Minimum JPEG quality for compression
- Default: `70` (minimum acceptable quality for text readability)
- Range: `1-100`
- Lower = more compression, higher risk of illegible text
- Higher = less compression, may not meet size limit

**`IMAGE_COMPRESSION_ENABLED`** - Enable/disable automatic compression
- Default: `true`
- Set to `false` to disable compression (images >5MB will fail)

**Example logging output when compression occurs:**
```
✓ Image compressed: 6.20MB → 4.80MB (quality=80, ratio=1.29x)
```

#### Handwriting Reference

**`HANDWRITING_REFERENCE_ENABLED`** - Enable personalized OCR
- `true` (default) - Load handwriting reference for better accuracy
- `false` - Use standard OCR without personalization

**`HANDWRITING_REFERENCE_FILE`** - Path to reference JSON
- Default: `./handwriting-reference.json`
- Can be absolute or relative path

### Handwriting Reference JSON

See [handwriting-reference.json](handwriting-reference.json) for the configuration format.

**Available fields:**

```json
{
  "referenceWords": ["array", "of", "sample", "words"],
  "specialCharacters": ["@ # $ %"],
  "referenceImagePath": "./handwriting-samples/reference-sheet.jpeg",
  "notes": "Personal notes (not used by OCR)",
  
  "domainGlossary": {
    "acronyms": {
      "API": "Application Programming Interface",
      "OCR": "Optical Character Recognition"
    },
    "properNouns": ["CompanyName", "ProjectName"],
    "businessTerms": ["onboarding", "roadmap"],
    "specialNotation": {
      "arrow": "→",
      "description": "Preserve arrows as →"
    }
  },
  
  "ocrValidation": {
    "enabled": true,
    "confidenceThreshold": 0.7,
    "skipSummarizationThreshold": 0.5,
    "appendReportOnIssues": true
  },
  
  "ocrCorrection": {
    "enabled": true,
    "correctCriticalOnly": true,
    "tagCorrections": true,
    "maxCorrectionsPerImage": 10,
    "minIssueConfidence": 0.8
  }
}
```

**Field descriptions:**
- `referenceWords` - Sample words in your handwriting style
- `specialCharacters` - Special characters you commonly use
- `referenceImagePath` - Path to handwriting sample image
- `domainGlossary.acronyms` - Common acronyms with definitions
- `domainGlossary.properNouns` - Names, products, locations
- `domainGlossary.businessTerms` - Domain-specific terminology
- `ocrValidation.enabled` - Enable quality validation (true/false)
- `ocrValidation.confidenceThreshold` - Minimum confidence to proceed (0.0-1.0)
- `ocrCorrection.enabled` - Enable automatic correction (true/false)
- `ocrCorrection.correctCriticalOnly` - Only fix critical issues (true/false)

---

## 🎯 How It Works

1. **AI Provider Selection**: Chooses AI service based on configuration
   - Auto-detects HAI proxy or falls back to OpenAI direct
   - Supports OpenAI (GPT-4o) or Claude (via HAI proxy)
   
2. **Image Preprocessing**: Grayscale conversion, resizing, normalization, sharpening

3. **Handwriting Reference**: Loads your personal handwriting reference (optional)
   - Reference words and sample images
   - Domain glossary (acronyms, proper nouns, business terms)
   
4. **OCR with Vision AI**: Sends preprocessed image + reference to AI provider
   - Uses GPT-4o or Claude 3.5 Sonnet for vision analysis
   - Understands handwriting context and style
   
5. **Layout Detection**: AI determines if content is table or freeform

6. **Markdown Conversion**: Transcribes to valid markdown with preserved structure

7. **Quality Validation**: Analyzes OCR output for errors (optional)
   - Identifies grammatical issues, incomplete phrases, encoding errors
   - Provides confidence score and recommendations
   
8. **Automatic Correction**: Fixes critical OCR errors (optional)
   - Re-processes problematic phrases with targeted prompts
   - Tags corrections for transparency
   
9. **Summarization**: Generates structured summary (optional)
   - Uses GPT-4o-mini or Claude 3.5 Haiku for efficiency
   - Extracts action items, key learnings, decisions, and tags

---

## 💡 Tips for Best Results

### Creating Your Handwriting Reference:
- ✓ Use your natural, everyday handwriting style
- ✓ Use the same pen type you typically use for notes
- ✓ Include words where certain letters appear in different contexts
- ✓ Update the reference if your handwriting style changes

### Taking Photos of Notes:
- ✓ Use good lighting (avoid dim rooms)
- ✓ Keep camera directly above paper (not angled)
- ✓ Ensure clear focus on text
- ✓ Avoid shadows and glare
- ✓ Higher resolution = better results
- ✓ Dark ink on white paper works best

---

## 🔧 Troubleshooting

### "No images processed"
- Check that `MONITORED_FOLDERS` paths exist in [src/main.ts](src/main.ts)
- Verify images are `.jpg`, `.jpeg`, or `.png` format
- Images with existing `.md` files are skipped (already processed)

### "Reference image not loading"
- Check path in `handwriting-reference.json` matches actual file
- Verify the image file exists in the correct location
- Check file extension (`.jpg` vs `.jpeg`)
- Look for warning messages in console output

### "OCR accuracy is poor"
- ✅ Set up handwriting reference (image-based recommended)
- ✅ Use better lighting when photographing notes
- ✅ Increase photo resolution
- ✅ Ensure handwriting is reasonably legible

### "API errors"
- **For OpenAI:**
  - Verify `OPENAI_API_KEY` in `.env` is correct
  - Check you have API credits available
  - Visit https://platform.openai.com/usage to check usage
- **For HAI Proxy:**
  - Verify HAI proxy is running: `lsof -i :6655`
  - Check HAI authentication: `hai auth login`
  - Review HAI logs: `hai proxy logs`
- Review console error messages for specific details

---

## 📊 API Costs

### Using HAI Proxy (SAP Employees)
- **FREE** - No cost for all operations
- Uses corporate AI infrastructure
- No API key or billing required

### Using OpenAI Direct
- **OCR**: GPT-4o with vision (~$0.01-0.05 per image)
  - Depends on image size and reference complexity
  - Pricing: https://openai.com/api/pricing/
- **Summarization**: GPT-4o-mini (~$0.001 per summary)
- **Validation**: GPT-4o-mini (~$0.0005 per validation)
- **Reference images**: Slight increase in OCR cost but improves accuracy

**Cost optimization tips:**
- Use HAI proxy if you're a SAP employee (free)
- Use cheaper models for summarization/validation (already default)
- Use Claude 3.5 Haiku via HAI for faster, more cost-effective processing

---

## 📁 Project Structure

```
.
├── src/                           # Source code
│   ├── main.ts                    # Main orchestrator and folder monitoring
│   ├── ocr.ts                     # OCR processing with compression and reference
│   ├── ocrValidator.ts            # OCR quality validation and correction
│   ├── summarize.ts               # AI-powered summarization
│   ├── aiProvider.ts              # AI provider abstraction (HAI/OpenAI)
│   ├── handwritingReference.ts    # Handwriting reference management
│   └── utils.ts                   # Utility functions
├── tests/                         # Test suite
│   ├── image-compression.test.ts  # Compression functionality tests
│   ├── README.md                  # Test suite documentation
│   └── MODELS.md                  # Available AI models reference
├── docs/                          # Documentation
│   ├── guides/                    # User guides
│   │   └── testing.md             # How to run tests
│   ├── architecture/              # Technical documentation
│   │   └── system-architecture.md # Complete system architecture
│   └── archive/                   # Historical documents
├── handwriting-samples/           # Store your handwriting reference images
│   ├── README.md                  # Instructions for creating references
│   └── reference-sheet.jpeg       # Your handwriting sample (create this!)
├── openspec/                      # OpenSpec workflow management
│   ├── specs/                     # Active specifications
│   └── changes/                   # Change proposals and archives
├── handwriting-reference.json     # Handwriting reference config
├── .env                           # Environment variables (API key, config)
├── CHANGELOG.md                   # Version history
├── CONFIG.md                      # Detailed configuration guide
├── package.json
└── README.md
```

---

## 📚 Documentation

- **[Getting Started](README.md)** - This file - installation and quick start
- **[Configuration Guide](CONFIG.md)** - Detailed configuration options and model selection
- **[System Architecture](docs/architecture/system-architecture.md)** - Complete technical documentation
- **[Testing Guide](docs/guides/testing.md)** - How to run tests
- **[OCR Testing Framework](#-ocr-testing-framework)** - OCR accuracy testing and experimentation
- **[Version History](CHANGELOG.md)** - What's new in each version
- **[Available Models](tests/MODELS.md)** - Complete AI model reference

---

## 🧪 OCR Testing Framework

The OCR Testing Framework provides automated testing and experimentation capabilities to measure and improve OCR accuracy for handwritten notes.

### Features

- **Automated Testing**: Compare OCR output against expected (gold standard) text
- **Accuracy Metrics**: Character-level accuracy, word F1 score, edit distance
- **Baseline Tracking**: Track improvements/regressions over time
- **Model Experimentation**: Systematically test different AI models
- **Prompt Experimentation**: Test different prompting strategies
- **Preprocessing Experimentation**: Test image preprocessing variations
- **Scoring & Recommendations**: Weighted scoring with automatic best-config selection
- **Experiment History**: Persistent storage of all experiment results

### Quick Start

#### 1. Create Test Cases

Test cases consist of paired files in `test-images/`:
- **Input**: `<name>.jpeg` - Your handwritten note image
- **Expected**: `<name> expected.txt` - Gold standard transcription

Example:
```
test-images/
├── Meeting Notes.jpeg
└── Meeting Notes expected.txt
```

See [test-images/README.md](test-images/README.md) for format details.

#### 2. Run a Single Test

```bash
npm run test-ocr "test-images/Meeting Notes.jpeg"
```

Output includes:
- Character accuracy (%)
- Word precision/recall/F1
- Edit distance
- Italic marker count
- Pass/fail status
- Unified diff (if failed with `--show-diff`)

#### 3. Run Full Test Suite

```bash
npm run test-ocr-suite
```

Runs all test cases in `test-images/` and generates summary report.

#### 4. Run Model Experiments

Test different AI models to find the best for your handwriting:

```bash
# Test all available models
npm run experiment-ocr "test-images/Meeting Notes.jpeg"

# Test specific models
npm run experiment-ocr "test-images/Meeting Notes.jpeg" -- --type=model --models=opus,gpt4o
```

Results include:
- Tabular comparison (accuracy, cost, latency, score)
- Recommended configuration with rationale
- Experiment history stored in `test-results/experiments/`

### Testing Commands

**Single Test:**
```bash
npm run test-ocr <image-path> [options]

Options:
  --show-diff              Show line-by-line diff for failures
  --format=console|json|markdown
  --min-accuracy=N         Character accuracy threshold (default: 80)
  --min-f1=N               Word F1 threshold (default: 0.7)
  --compare-baseline       Compare against baseline
```

**Test Suite:**
```bash
npm run test-ocr-suite [options]

Options:
  --directory=DIR          Test images directory (default: test-images)
  --format=console|markdown|json
  --output=FILE            Save report to file
```

**Model Experiments:**
```bash
npm run experiment-ocr <image-path> [options]

Options:
  --type=TYPE              model|prompt|preprocessing|combined
  --models=LIST            Comma-separated models (e.g., opus,gpt4o)
  --prompts=LIST           Comma-separated prompts
  --preprocessing=LIST     Comma-separated preprocessing configs
  --weights=W1,W2,W3       Score weights: accuracy,cost,latency
  --format=console|markdown|json
  --output=FILE            Save report to file
```

### Available Models

Use these model identifiers with `--models`:

- `claude-sonnet-4.6` - Claude 4.6 Sonnet (default)
- `claude-opus-4-6` - Claude 4.6 Opus
- `gpt-4o` - GPT-4o
- `gpt-4-vision-preview` - GPT-4 Vision

### Baseline Tracking

Establish a baseline to track improvements over time:

```bash
# Run test and compare to baseline
npm run test-ocr "test-images/Meeting Notes.jpeg" -- --compare-baseline
```

Baseline metrics are stored in `test-results/baseline.json` and include:
- Model used
- Accuracy metrics (character accuracy, word F1, etc.)
- Processing time
- Cost estimate
- Timestamp

### Experiment Types

**Model Experiments** (`--type=model`):
- Test different AI models (Claude, GPT-4o, etc.)
- Find the best model for your handwriting style

**Prompt Experiments** (`--type=prompt`):
- Test different prompting strategies
- Options: `baseline`, `verbose`, `concise`, `with-glossary`

**Preprocessing Experiments** (`--type=preprocessing`):
- Test image preprocessing variations
- Options: `none`, `light-sharpen`, `heavy-sharpen`, `contrast-boost`, `full-enhancement`

**Combined Experiments** (`--type=combined`):
- Test all combinations of models, prompts, and preprocessing
- Example: 3 models × 2 prompts = 6 configurations tested

### Scoring Algorithm

Results are scored using a weighted composite (default weights):
- **Accuracy**: 70% weight - Character-level accuracy (0-100%)
- **Cost**: 15% weight - Lower cost is better
- **Latency**: 15% weight - Lower processing time is better

Customize weights:
```bash
npm run experiment-ocr "test.jpeg" -- --weights=0.8,0.1,0.1
```

### Test Metrics

**Character-Level:**
- Accuracy: % of characters correctly transcribed
- Edit Distance: Levenshtein distance between actual and expected

**Word-Level:**
- Precision: % of transcribed words that are correct
- Recall: % of expected words that were found
- F1 Score: Harmonic mean of precision and recall

**Quality Indicators:**
- Italic Count: Number of uncertain words marked with `*asterisks*`
- Italic Percentage: % of words marked as uncertain

### 🔬 Structured Experimentation Workflow

For systematic OCR improvement experiments, use the `/experiment-ocr` skill:

```bash
# Ideate new experiments based on current findings
/experiment-ocr

# The skill will:
# 1. Review recent experiments and known issues
# 2. Propose 3-5 experiment ideas with impact/effort analysis
# 3. Help you design hypothesis, methodology, success criteria
# 4. Create organized experiment folder with documentation
# 5. Execute the experiment with proper tooling
# 6. Analyze results and document findings
# 7. Update experiment summary automatically
```

**Experiment Organization:**

Each experiment is self-contained in `experiments/XXX-name/`:
```
experiments/
├── README.md                    # Experiment catalog and templates
├── 001-initial-model-comparison/
│   ├── hypothesis.md            # What we're testing and why
│   ├── results.json             # Raw experimental data
│   ├── findings.md              # Analysis and conclusions
│   └── artifacts/               # Supporting files
├── 002-full-model-suite/
└── 003-hai-proxy-compatible/
```

**Key Benefits:**
- ✅ **Structured approach** - Clear hypothesis → methodology → findings
- ✅ **Historical tracking** - All experiments documented with context
- ✅ **Reproducible** - Methodology and configurations saved
- ✅ **Knowledge building** - Each experiment informs the next
- ✅ **Automated summary** - `npm run generate-experiment-summary`

**Documentation:**
- `EXPERIMENTS.md` - Overview of all experiments with key findings
- `OCR_MODEL_SELECTION.md` - Current model recommendations
- `experiments/README.md` - Experiment templates and guidelines

### Directory Structure

```
test-images/           # Test cases (image + expected output pairs)
test-results/          # Test results and history
├── baseline.json      # Current baseline metrics
└── experiments/       # Historical experiment results
    ├── <test>-model-<timestamp>.json
    └── <test>-prompt-<timestamp>.json
```

### Creating Test Cases

1. **Prepare image**: Take a clear photo of your handwritten notes
2. **Create expected output**: Manually transcribe to `<name> expected.txt`
   - Preserve formatting (bullets, indentation, line breaks)
   - Use `-` for bullets, `→` for arrows
   - Keep acronyms in ALL-CAPS
3. **Save files**: 
   - `test-images/<name>.jpeg`
   - `test-images/<name> expected.txt`
4. **Run test**: `npm run test-ocr "test-images/<name>.jpeg"`

See [test-images/README.md](test-images/README.md) for detailed format guidelines.

### Environment Variables

Fine-tune testing behavior:

```env
# OCR quality thresholds
OCR_UNCERTAIN_THRESHOLD=0.30     # Trigger fallback if >30% uncertain
OCR_LEGACY_QUALITY_CHECK=false   # Disable italic detection

# Experiment defaults (optional)
OCR_EXPERIMENT_TYPE=model        # Default experiment type
OCR_SCORE_WEIGHTS=0.7,0.15,0.15 # accuracy,cost,latency
```

### Troubleshooting

**"Expected output file not found"**
- Ensure `<name> expected.txt` exists alongside `<name>.jpeg`
- Check file naming convention matches exactly

**"No test cases discovered"**
- Verify `.jpeg` files have matching ` expected.txt` files
- Check directory path is correct

**"Test failed with low accuracy"**
- Review diff output (`--show-diff`) to see specific errors
- Consider adding domain-specific terms to `handwriting-reference.json`
- Try different models with experiment mode

**"Experiment results not persisted"**
- Verify `test-results/experiments/` directory is writable
- Check console for storage error messages

For more details, see the testing documentation in [test-images/README.md](test-images/README.md) and [test-results/README.md](test-results/README.md).

---

## 📚 Documentation

---

## 🆘 Support

For issues or questions:
- Check the troubleshooting section above
- Review console output for error messages
- Verify all configuration files are properly formatted JSON
- See [System Architecture](docs/architecture/system-architecture.md) for technical details

---

## License

MIT
