# Domain Glossary Curation Guide

The domain glossary in `handwriting-reference.json` helps the OCR system recognize industry-specific acronyms, proper nouns, and business terms that may be unfamiliar to the AI models.

## When to Add Terms

Add terms to the glossary when:
- OCR consistently misreads specific acronyms or technical terms
- Your field uses industry-specific jargon or abbreviations
- You frequently write about specific products, companies, or locations
- Certain words appear in italics (*uncertain*) when they shouldn't be

## Glossary Structure

The glossary is organized into four categories in `handwriting-reference.json`:

```json
{
  "domainGlossary": {
    "acronyms": {
      "API": "Application Programming Interface",
      "OCR": "Optical Character Recognition"
    },
    "properNouns": ["CompanyName", "ProjectName", "PersonName"],
    "businessTerms": ["onboarding", "roadmap", "milestone"],
    "specialNotation": {
      "arrow": "→",
      "description": "Preserve arrows as →"
    }
  }
}
```

### Category Guidelines

**acronyms:**
- All-caps abbreviations (API, OCR, K8s)
- Include full expansion for context
- Use for: technical acronyms, company names, location codes
- Format: `"ACRONYM": "Full Expansion"`

**properNouns:**
- Capitalized names: companies, products, people, locations
- Use for: brand names, project names, tools, frameworks
- Format: Array of strings with proper capitalization
- Example: `["Dynatrace", "ArgoCD", "Azure"]`

**businessTerms:**
- Domain-specific vocabulary (lowercase unless proper noun)
- Use for: industry jargon, technical terms, process names
- Format: Array of strings
- Example: `["onboarding", "service binding", "orphan instance"]`

**specialNotation:**
- Symbols and notation to preserve
- Use for: arrows, mathematical symbols, custom notation
- Format: Object with notation and description

## Adding Terms

### 1. Identify Misread Terms

Run a test to identify problematic terms:

```bash
npm run test-ocr "test-images/Your Notes.jpeg" -- --show-diff
```

Look for:
- Words marked with *asterisks* (uncertain)
- Misspellings of known acronyms
- Incorrect capitalization of proper nouns

### 2. Add to Appropriate Category

Edit `handwriting-reference.json`:

**For acronyms:**
```json
"acronyms": {
  "BTP": "Business Technology Platform",
  "K8s": "Kubernetes"
}
```

**For proper nouns:**
```json
"properNouns": [
  "Dynatrace",
  "Vault",
  "Pruthvi"
]
```

**For business terms:**
```json
"businessTerms": [
  "multi-values file",
  "service binding"
]
```

### 3. Test Impact

Re-run the test to measure improvement:

```bash
npm run test-ocr "test-images/Your Notes.jpeg" -- --compare-baseline
```

Check if:
- Accuracy improved
- Fewer words marked as uncertain (italic %)
- Previously misread terms are now correct

### 4. Update Baseline

If accuracy improved, store as new baseline:

```bash
# Results are automatically stored in test-results/experiments/
# Manually update baseline.json after validation
```

## Best Practices

### DO:
- ✅ Add terms you frequently use in your notes
- ✅ Use consistent capitalization (especially for proper nouns)
- ✅ Provide context in acronym expansions
- ✅ Group related terms together
- ✅ Test before and after to measure impact

### DON'T:
- ❌ Add common English words (AI already knows these)
- ❌ Add terms that appear only once
- ❌ Use inconsistent capitalization
- ❌ Add abbreviations that vary (standardize first)

## Examples by Domain

### Software Engineering
```json
{
  "acronyms": {
    "API": "Application Programming Interface",
    "CI/CD": "Continuous Integration/Continuous Deployment",
    "K8s": "Kubernetes",
    "DB": "Database"
  },
  "properNouns": ["GitHub", "Docker", "PostgreSQL"],
  "businessTerms": ["deployment", "refactoring", "tech debt"]
}
```

### Business/Sales
```json
{
  "acronyms": {
    "CRM": "Customer Relationship Management",
    "ROI": "Return on Investment",
    "KPI": "Key Performance Indicator"
  },
  "properNouns": ["Salesforce", "HubSpot"],
  "businessTerms": ["pipeline", "quota", "forecasting"]
}
```

### DevOps/Infrastructure
```json
{
  "acronyms": {
    "BTP": "Business Technology Platform",
    "DT": "Dynatrace",
    "SPN": "Service Principal Name",
    "ArgoCD": "GitOps continuous delivery tool"
  },
  "properNouns": ["Dynatrace", "Vault", "Azure", "JIRA"],
  "businessTerms": ["service binding", "multi-values file", "orphan instance"]
}
```

## Measuring Impact

Track glossary effectiveness:

1. **Before adding terms:**
   ```bash
   npm run test-ocr "test.jpeg" > before.txt
   ```

2. **After adding terms:**
   ```bash
   npm run test-ocr "test.jpeg" > after.txt
   ```

3. **Compare:**
   - Character accuracy change
   - Reduction in italic % (uncertain words)
   - Specific term corrections in diff

Expected impact:
- **Marginal improvement**: 1-5% accuracy for domain-heavy notes
- **Significant improvement**: 5-15% for highly technical/specialized content
- **Minimal improvement**: <1% for general meeting notes

## Maintenance

Review and update glossary:
- **Quarterly**: Add new terms from recent projects
- **After major changes**: Re-run tests to verify no regressions
- **When accuracy drops**: Check if new terms need to be added

Keep glossary focused - aim for 20-50 terms per category. Too many terms can dilute effectiveness.
