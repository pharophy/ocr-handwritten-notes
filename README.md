# Handwritten OCR CLI

Automated OCR tool for converting handwritten notes to markdown with AI-powered summarization.

## Features

- **Handwriting OCR**: Converts handwritten notes (images) to structured markdown
- **Smart Layout Detection**: Automatically detects tables vs. freeform notes
- **AI Summarization**: Generates structured summaries with action items, learnings, and decisions
- **Handwriting Reference**: Personalized character recognition based on your writing style
- **Batch Processing**: Processes multiple images in monitored folders

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
1. Install HAI CLI: [Installation Guide](https://ai-docs.portal.hyperspace.tools.sap/llm-proxy/recipes/cline/)
2. Authenticate: `hai auth login`

**Configuration:**
No configuration needed! The system will:
- Auto-detect HAI proxy running on port 6655
- Auto-start HAI proxy if not running
- Use Claude 3.5 Sonnet for OCR by default

**Configuration (optional):**
Create `.env` file to customize settings:
```env
AI_PROVIDER=hai-claude
HAI_AUTO_START=true                # Auto-start proxy if not running
HAI_PROXY_PORT=6655               # Default port
ANTHROPIC_BASE_URL=http://localhost:6655/anthropic/

# Optional: Customize models
AI_MODEL_OCR=anthropic--claude-4.5-sonnet
AI_MODEL_SUMMARIZATION=anthropic--claude-4.5-haiku
AI_MODEL_VALIDATION=anthropic--claude-4.5-haiku
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
```

Get your API key from: https://platform.openai.com/api-keys

#### Option C: HAI Proxy with OpenAI

Use OpenAI models through HAI proxy instead of Claude:

```env
AI_PROVIDER=hai-openai
# HAI proxy will be auto-started
```

### Troubleshooting AI Provider

**"HAI CLI not found in PATH"**
- Install HAI CLI: [Installation Guide](https://ai-docs.portal.hyperspace.tools.sap/llm-proxy/recipes/cline/)
- Restart your terminal after installation

**"HAI proxy is not running"**
- Auto-start is enabled by default
- Manual start: `hai proxy start`
- Check status: `lsof -i :6655`
- Disable auto-start: `HAI_AUTO_START=false` in `.env`

**"OPENAI_API_KEY is required"**
- For OpenAI direct, set `OPENAI_API_KEY` in `.env`
- For HAI proxy, the key is managed automatically

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

### Environment Variables (.env)

All AI provider configuration is managed through environment variables in the `.env` file. See [.env.example](.env.example) for a complete reference with all available options and their descriptions.

#### AI Provider Selection

**`AI_PROVIDER`** - Choose which AI service to use
- `openai` - Use OpenAI directly (requires OPENAI_API_KEY)
- `hai-claude` - Use Claude via HAI proxy (recommended for SAP)
- `hai-openai` - Use OpenAI via HAI proxy
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
- Usually auto-configured by HAI CLI
- Rarely needs manual configuration

#### Model Selection (Optional)

**`AI_MODEL_OCR`** - Model for handwriting OCR (requires vision)
- **OpenAI options:**
  - `gpt-4o` (default) - Latest GPT-4 with vision, best accuracy
  - `gpt-4-turbo` - GPT-4 Turbo with vision
  - `gpt-4-vision-preview` - Preview version
  - Full list: https://platform.openai.com/docs/models
- **Claude via HAI options:**
  - `anthropic--claude-4.5-sonnet` (default) - Best for handwriting
  - `anthropic--claude-opus-4` - Highest accuracy
  - `anthropic--claude-4.5-haiku` - Faster, lower cost
  - List models: Run `hai models` command

**`AI_MODEL_SUMMARIZATION`** - Model for generating summaries
- **OpenAI options:**
  - `gpt-4o-mini` (default) - Optimized for speed/cost
  - `gpt-4o` - More capable, higher cost
  - `gpt-3.5-turbo` - Fastest, lowest cost
- **Claude via HAI options:**
  - `anthropic--claude-4.5-haiku` (default) - Fast and cost-effective
  - `anthropic--claude-4.5-sonnet` - More capable
  - `anthropic--claude-opus-4` - Highest quality

**`AI_MODEL_VALIDATION`** - Model for OCR quality validation
- **OpenAI options:**
  - `gpt-4o-mini` (default) - Recommended
  - `gpt-4o` - More thorough validation
  - `gpt-3.5-turbo` - Fastest
- **Claude via HAI options:**
  - `anthropic--claude-4.5-haiku` (default) - Fast validation
  - `anthropic--claude-4.5-sonnet` - More thorough

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
