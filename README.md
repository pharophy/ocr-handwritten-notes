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

## ⚙️ Advanced Configuration

### Environment Variables

Edit `.env`:

```env
# Required
OPENAI_API_KEY=your_key_here

# Optional: Handwriting Reference
HANDWRITING_REFERENCE_ENABLED=true
HANDWRITING_REFERENCE_FILE=./handwriting-reference.json
```

### Handwriting Reference Configuration

See [handwriting-reference.json](handwriting-reference.json) for the configuration format.

**All fields are optional:**

```json
{
  "referenceWords": ["list", "of", "sample", "words"],
  "specialCharacters": ["@ # $ %"],
  "referenceImagePath": "./handwriting-samples/reference-sheet.jpeg",
  "notes": "Your personal notes (not used by OCR)"
}
```

---

## 🎯 How It Works

1. **Image Preprocessing**: Grayscale conversion, resizing, normalization, sharpening
2. **Handwriting Reference**: Loads your personal handwriting reference (optional)
3. **OCR with GPT-4o Vision**: Sends preprocessed image + reference to OpenAI
4. **Layout Detection**: AI determines if content is table or freeform
5. **Markdown Conversion**: Transcribes to valid markdown with preserved structure
6. **Summarization**: Generates structured summary with GPT-4o-mini (optional)

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
- Verify `OPENAI_API_KEY` in `.env` is correct
- Check you have API credits available
- Review console error messages for details

---

## 📊 API Costs

- **OCR**: GPT-4o with vision (~$0.01-0.05 per image)
- **Summarization**: GPT-4o-mini (~$0.001 per summary)
- **Reference images**: Slight increase in OCR cost but improves accuracy

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
