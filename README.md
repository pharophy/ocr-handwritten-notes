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
AI_MODEL_OCR=anthropic--claude-4.6-sonnet
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
AI_MODEL_OCR=anthropic--claude-4.6-sonnet
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
AI_MODEL_OCR=gpt-4o
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

**`AI_MODEL_OCR`** - Model for handwriting OCR (requires vision)
- **OpenAI options (via HAI proxy or direct):**
  - `gpt-5` - Latest GPT-5 with vision, best accuracy
  - `gpt-5-mini` - GPT-5 Mini, faster and cost-effective
  - `gpt-4.1` - GPT-4.1 with vision
  - `gpt-4.1-mini` - GPT-4.1 Mini
  - Full list: https://platform.openai.com/docs/models
- **Claude options (via HAI proxy, recommended):**
  - `anthropic--claude-4.6-sonnet` - Latest Claude 4.6 Sonnet (recommended)
  - `anthropic--claude-4.6-opus` - Claude 4.6 Opus, highest accuracy
  - `anthropic--claude-4.5-sonnet` - Claude 4.5 Sonnet, excellent for handwriting
  - `anthropic--claude-4.5-opus` - Claude 4.5 Opus
  - `anthropic--claude-4.5-haiku` - Claude 4.5 Haiku, faster and lower cost
  - `anthropic--claude-4-sonnet` - Claude 4 Sonnet
- List all models: Run `hai version` to check CLI version and test models

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
├── src/
│   ├── main.ts                    # Main orchestrator and folder monitoring
│   ├── ocr.ts                     # OCR processing with handwriting reference
│   ├── summarize.ts               # AI-powered summarization
│   ├── handwritingReference.ts    # Handwriting reference management
│   └── utils.ts                   # Utility functions
├── handwriting-samples/           # Store your handwriting reference images
│   ├── README.md                  # Instructions for creating references
│   └── reference-sheet.jpeg       # Your handwriting sample (create this!)
├── handwriting-reference.json     # Handwriting reference config
├── .env                           # Environment variables (API key, config)
├── package.json
└── README.md
```

---

## 🆘 Support

For issues or questions:
- Check the troubleshooting section above
- Review console output for error messages
- Verify all configuration files are properly formatted JSON

---

## License

MIT
