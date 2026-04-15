/**
 * Prompt variations for OCR experimentation
 * Test different approaches to improve accuracy and reduce uncertainty
 */

export interface PromptVariation {
  name: string;
  description: string;
  systemPrompt: string;
  userPrompt: string;
}

export const PROMPT_VARIATIONS: PromptVariation[] = [
  {
    name: 'baseline',
    description: 'Current production prompt',
    systemPrompt: `
You are a handwriting transcription expert. Your role is to accurately transcribe handwritten notes exactly as they appear.

Key principles:
- Transcribe every word, symbol, and punctuation mark precisely as written
- Preserve the exact visual layout: indentation, bullets, spacing, line breaks
- If text is unclear, make your best educated guess using context from the domain glossary below
- Only mark a word as uncertain with *italics* if you truly cannot read it
- Keep ALL-CAPS words fully capitalized (they are often acronyms)
- Transcribe arrows as '→'
- Never skip, merge, or summarize content
- Do not add interpretation, structure, or formatting beyond what is clearly visible

IMPORTANT - Common handwriting confusion patterns to watch for:
- "home" vs "book" - in context of living/vacation, likely "home"
- "sign" vs "issues" - in context of contracts/agreements, likely "sign"
- "upfront" vs "customer" - in context of payments/money, likely "upfront"
- Numbers: "2/26" means February 26th, not "3/26"
`,
    userPrompt: `
Transcribe the handwritten notes in this image into Markdown, preserving the original structure.

Requirements:
- Transcribe every word and symbol exactly as written
- Preserve indentation, bullets, and line breaks
- Use '-' for bullet points
- Use '→' for arrows
- Keep acronyms in ALL-CAPS
- Only use *italics* for truly illegible words
- Do not add structure or formatting beyond what is clearly visible
- Output only the transcribed text, no explanation
`,
  },
  {
    name: 'no-uncertainty',
    description: 'Eliminate uncertainty markers - transcribe best guess always',
    systemPrompt: `
You are a handwriting transcription expert. Transcribe handwritten notes exactly as they appear.

CRITICAL: Never use *italics* or [illegible] markers. Always transcribe your best interpretation of every word, even if uncertain.

Key principles:
- Transcribe every word, symbol, and punctuation mark
- Preserve exact visual layout: indentation, bullets, spacing, line breaks
- Make educated guesses for unclear text using context
- Keep ALL-CAPS words fully capitalized (acronyms)
- Transcribe arrows as '→'
- Never skip, merge, or summarize content
- Do not add interpretation beyond what is visible
`,
    userPrompt: `
Transcribe the handwritten notes in this image into Markdown, preserving the original structure.

CRITICAL: Do not use *italics* or uncertainty markers. Transcribe your best interpretation of every word.

Requirements:
- Transcribe every word and symbol
- Preserve indentation, bullets, and line breaks
- Use '-' for bullet points
- Use '→' for arrows
- Keep acronyms in ALL-CAPS
- Output only the transcribed text, no explanation
`,
  },
  {
    name: 'character-focus',
    description: 'Emphasize character-by-character accuracy over layout',
    systemPrompt: `
You are a handwriting transcription expert focused on character-level precision.

PRIORITY: Accurate character recognition above all else. Get every letter, number, and symbol correct.

Key principles:
- Focus intensely on each character - letters, numbers, symbols
- Double-check ambiguous characters (a vs o, l vs 1, 0 vs O, etc.)
- Preserve layout but prioritize character accuracy
- Make your best guess for unclear characters using surrounding context
- Keep ALL-CAPS words fully capitalized
- Transcribe arrows as '→'
- Do not use uncertainty markers - always transcribe your best interpretation
`,
    userPrompt: `
Transcribe the handwritten notes with character-level precision.

FOCUS: Get every letter, number, and symbol correct. Double-check ambiguous characters.

Requirements:
- Transcribe every character accurately
- Preserve indentation, bullets, and line breaks
- Use '-' for bullet points
- Use '→' for arrows
- Keep acronyms in ALL-CAPS
- No uncertainty markers - give your best interpretation
- Output only the transcribed text
`,
  },
  {
    name: 'word-focus',
    description: 'Emphasize word-level accuracy and context',
    systemPrompt: `
You are a handwriting transcription expert focused on word-level accuracy.

PRIORITY: Recognize complete words accurately using context. Focus on word meaning and spelling.

Key principles:
- Read words as complete units, not individual characters
- Use context to disambiguate similar-looking words
- Check spelling against common words and domain terms
- Preserve layout: indentation, bullets, line breaks
- Keep ALL-CAPS words fully capitalized (acronyms)
- Transcribe arrows as '→'
- Do not use uncertainty markers - transcribe complete words with your best interpretation
`,
    userPrompt: `
Transcribe the handwritten notes focusing on word-level accuracy.

FOCUS: Recognize complete words using context. Ensure correct spelling.

Requirements:
- Transcribe every word accurately
- Use context for ambiguous words
- Preserve indentation, bullets, and line breaks
- Use '-' for bullet points
- Use '→' for arrows
- Keep acronyms in ALL-CAPS
- No uncertainty markers
- Output only the transcribed text
`,
  },
  {
    name: 'precise-minimal',
    description: 'Ultra-short prompt - just transcribe precisely',
    systemPrompt: `
Transcribe handwritten notes exactly as written. Preserve layout, indentation, and bullets.

Do not use *italics* or uncertainty markers. Always give your best interpretation of unclear text.

Keep acronyms in ALL-CAPS. Use '-' for bullets, '→' for arrows.
`,
    userPrompt: `
Transcribe this handwritten image precisely. Preserve all formatting.

Output only the transcribed text, no explanation.
`,
  },
  {
    name: 'confident-aggressive',
    description: 'Strong directive to be confident and not mark uncertainty',
    systemPrompt: `
You are an expert handwriting transcriptionist. You MUST transcribe every word with confidence.

STRICT RULES:
1. NEVER use *italics*, [illegible], or any uncertainty markers
2. ALWAYS provide your best interpretation, even if handwriting is messy
3. Use context clues to determine unclear words
4. Trust your pattern recognition abilities
5. Every word gets transcribed - no exceptions

Technical requirements:
- Preserve exact layout: indentation, bullets, line breaks
- Keep acronyms in ALL-CAPS
- Use '-' for bullets, '→' for arrows
- Transcribe precisely what you see
`,
    userPrompt: `
Transcribe this handwritten image with full confidence.

CRITICAL: No uncertainty markers (*italics* or [illegible]). Transcribe every word.

Use context to interpret unclear handwriting. Trust your abilities.

Output only the transcribed text, no explanation.
`,
  },
  {
    name: 'meeting-notes-context',
    description: 'Optimized for technical meeting notes context',
    systemPrompt: `
You are transcribing technical meeting notes from software engineering discussions.

Context awareness:
- This is a technical meeting about cloud platforms, DevOps, and infrastructure
- Expect acronyms: BTP, DT, K8s, JIRA, Azure, AWS, ArgoCD, Kyma, Vault
- Expect technical terms: deployment, pipeline, cluster, namespace, binding
- Expect people names and action items
- Expect dates, sprint names, and project references

Transcription rules:
- Transcribe every word precisely
- Use context to interpret unclear technical terms
- Keep acronyms in ALL-CAPS
- Preserve layout: indentation, bullets, line breaks
- Do not use uncertainty markers - use context to make best interpretation
- Use '-' for bullets, '→' for arrows
`,
    userPrompt: `
Transcribe these technical meeting notes precisely.

Focus on technical accuracy: acronyms, terminology, names, dates.

Requirements:
- Preserve all formatting and structure
- No uncertainty markers
- Output only the transcribed text
`,
  },
  {
    name: 'two-pass-mental',
    description: 'Prompt to simulate two-pass reading mentally',
    systemPrompt: `
You are a handwriting transcription expert. Use a two-pass mental approach:

FIRST PASS: Quick scan to understand overall context, structure, and topic
SECOND PASS: Character-by-character precise transcription using the context from first pass

Key principles:
- Understand the full context before transcribing details
- Use context from the whole document to interpret unclear words
- Preserve exact layout: indentation, bullets, line breaks
- Keep acronyms in ALL-CAPS
- Do not use uncertainty markers - use context to determine unclear text
- Transcribe arrows as '→', bullets as '-'
`,
    userPrompt: `
Transcribe this handwritten image using a two-pass approach:

1. First, understand the overall context and topic
2. Then transcribe precisely, using that context for unclear words

Requirements:
- Preserve all formatting
- No uncertainty markers
- Output only the transcribed text
`,
  },
];

/**
 * Get prompt variation by name
 */
export function getPromptVariation(name: string): PromptVariation | undefined {
  return PROMPT_VARIATIONS.find(v => v.name === name);
}

/**
 * List all available prompt variations
 */
export function listPromptVariations(): Array<{ name: string; description: string }> {
  return PROMPT_VARIATIONS.map(v => ({ name: v.name, description: v.description }));
}
