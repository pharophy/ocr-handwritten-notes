# Action Items Aggregator

## Why

Currently, action items are scattered across individual meeting note files in the ZZ_Raw folder. Each file has its own "Summary and Actions.md" with action items extracted from that specific meeting. This makes it difficult to:

- Get a holistic view of all pending action items across meetings
- Track which actions are completed vs. pending
- Prioritize work across multiple meeting contexts
- Avoid missing action items buried in individual note files

A consolidated action items summary would provide a single source of truth for all pending work items from handwritten meeting notes.

## What Changes

### New Script: `src/aggregate-actions.ts`

Create a new CLI tool that:

1. **Scans all markdown files** in the ZZ_Raw folder (and subdirectories)
2. **Extracts action items** from the "Action Items" section of each "Summary and Actions.md" file
3. **Filters out completed items**:
   - Skip lines containing `(Done)`
   - Skip lines containing `[X]` or `[x]`
4. **Aggregates all active action items** into a single file
5. **Outputs** to `action-items-summary-MM-DD.md` with:
   - Grouped by source file (meeting date/title)
   - Timestamp of when summary was generated
   - Total count of pending action items

### Output Format

```markdown
# Action Items Summary - Generated MM/DD/YYYY

Total pending action items: 12

## From Cosine 02-26.md
- AI: f/u w/ Pepsi on expectation here

## From NPB ENG Sync 03-18.md
- AI: Review architecture proposal with team
- AI: Schedule follow-up meeting for next week

## From Weekly Reflection 03-20.md
- AI: Document learnings from sprint retrospective
- AI: Share feedback with stakeholders

---
*Generated from 8 meeting note files*
*Excluded 5 completed items marked (Done) or [X]*
```

### CLI Usage

```bash
# Generate action items summary
npm run aggregate-actions

# Or with custom output location
npm run aggregate-actions -- --output /path/to/output.md
```

### Integration Points

- **Source**: `**/ZZ_Raw/**/*- Summary and Actions.md` files
- **Output**: `ZZ_Raw/action-items-summary-{MM-DD}.md`
- **Format**: Markdown with WikiLinks to source files
- **Scheduling**: Can be run manually or added to a cron job

## Implementation Plan

### 1. Core Aggregation Logic

**File**: `src/aggregate-actions.ts` (~150 lines)

```typescript
interface ActionItem {
  text: string;
  sourceFile: string;
  meetingName: string;
}

async function aggregateActionItems(
  folderPath: string
): Promise<ActionItem[]>

function filterCompletedItems(items: ActionItem[]): ActionItem[]

function formatAggregatedOutput(
  items: ActionItem[],
  metadata: AggregationMetadata
): string
```

### 2. Package Script

**File**: `package.json`

```json
{
  "scripts": {
    "aggregate-actions": "npx tsx src/aggregate-actions.ts"
  }
}
```

### 3. Configuration

Add to `handwriting-reference.json` (optional):

```json
{
  "actionAggregation": {
    "enabled": true,
    "completedMarkers": ["(Done)", "[X]", "[x]"],
    "outputFolder": "/Users/I566809/Library/CloudStorage/OneDrive-SAPSE/Notes/ZZ_Raw"
  }
}
```

### 4. Test Suite

**File**: `tests/action-aggregation.test.ts` (~10 tests)

- Parse action items from markdown
- Filter completed items correctly
- Handle missing "Action Items" sections
- Format output correctly
- Handle empty folders gracefully

## Success Metrics

- **Accuracy**: 100% of non-completed action items extracted
- **Precision**: 0% false positives (completed items excluded)
- **Performance**: <2s for 50 meeting files
- **Usability**: Single command generates summary

## Risks and Mitigations

**Risk**: Action items format varies across files
**Mitigation**: Use flexible parsing that looks for "Action Items" header and bullet points

**Risk**: User might have different completion markers
**Mitigation**: Make completion markers configurable in handwriting-reference.json

**Risk**: Large number of files could be slow
**Mitigation**: Parallel file reading, stream-based processing if needed

## Future Enhancements

- Automatic scheduling (run weekly)
- Priority tagging based on age or keywords
- Integration with task management tools (GitHub Issues, Jira)
- Diff view showing new vs. previous week's action items
