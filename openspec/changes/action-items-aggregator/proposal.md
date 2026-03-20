# Meeting Insights Aggregator

## Why

Currently, meeting insights are scattered across individual files in the ZZ_Raw folder. Each meeting has its own "Summary and Actions.md" but there's no consolidated view. This makes it difficult to:

- Get a holistic view of all pending action items across meetings
- Understand overall themes and patterns across multiple meetings
- Track which actions are completed vs. pending
- Identify and celebrate accomplishments buried in individual notes
- Reflect on key learnings and decisions from the past week/month
- Avoid missing action items buried in individual note files

A consolidated meeting insights report would provide:
- **Action Items**: Single source of truth for pending work
- **Meeting Digest**: High-level summary of what happened across all meetings
- **Accomplishments**: Highlight wins worth celebrating
- **Key Decisions**: Critical decisions made across meetings
- **Emerging Themes**: Patterns and recurring topics

## What Changes

### Enhanced Script: `src/aggregate-actions.ts` → `src/aggregate-insights.ts`

Expand the current action items aggregator into a comprehensive meeting insights aggregator that:

1. **Scans all markdown files** in the ZZ_Raw folder (and subdirectories)
2. **Extracts multiple sections** from each "Summary and Actions.md" file:
   - Action Items (existing functionality)
   - Summary paragraphs
   - Key Learnings
   - Key Decisions
   - Tags
3. **Filters out completed action items**:
   - Skip lines containing `(Done)`, `(done)`
   - Skip lines containing `[X]` or `[x]`
4. **Identifies accomplishments** by detecting:
   - Completed action items marked with (Done) or [X]
   - Key words in learnings/decisions: "achieved", "completed", "launched", "delivered", "success"
   - Positive sentiment phrases in summaries
5. **Generates consolidated insights report** with multiple sections

### Enhanced Output Format

```markdown
# Meeting Insights Report - Generated MM/DD/YYYY

## 📊 Overview
- **Meetings analyzed**: 12
- **Date range**: 02/26 - 03/20
- **Pending action items**: 11
- **Completed actions**: 5
- **Key decisions made**: 8

---

## 🎯 Pending Action Items

### From Cosine 02-26
- AI: f/u w/ Pepsi on expectation here

### From NPB ENG Sync 03-18
- AI: Review architecture proposal with team
- AI: Schedule follow-up meeting for next week

---

## 🎉 Accomplishments & Wins

### From NPB CI ENG Goal Setting 03-17
- ✅ Finalized goal setting distinction approach
- ✅ Completed follow-up with Barbara on milestones
- ✅ Resolved AI usage measurement approach

### From Weekly Reflection 03-20
- 🎯 Successfully delivered sprint features on time
- 🎯 Improved team collaboration across PM, UX, and Dev

---

## 📝 Meeting Digest

### Week of 02/26 - 03/03
**Cosine 02-26**: Discussed Pepsi integration, MLF project scope, Canada expansion plans. Key focus on AI automation and customer onboarding strategy.

### Week of 03/17 - 03/20
**NPB CI ENG Goal Setting**: Finalized team goal setting approach, clarified milestones tracking.

**NPB ENG Sync 03-18**: Scoped MLF project requirements, discussed e2e testing environment setup with Settlement team.

**Cosine 03-17**: Reviewed PIP process timeline, explored demand sensing use case opportunities.

**Weekly Reflection 03-20**: Sprint retrospective focusing on AI integration and roadmap planning.

---

## 💡 Key Learnings

- AI is becoming increasingly central to project development and customer engagement
- Effective onboarding and data management are critical for successful implementation
- Collaboration among PM, UX, and Dev teams is essential for innovation
- Need to balance AI focus with practical team capacity

---

## 🔑 Key Decisions

- Expand roadmap to include more topics and reduce onboarding support
- Continue AI focus but with balanced approach to team involvement
- Prioritize MLF scoping discussions with key stakeholders
- Implement e2e environment for internal testing (QA7)

---

## 🏷️ Trending Topics

#AI (8 meetings) | #Onboarding (5 meetings) | #Roadmap (4 meetings) | #Collaboration (6 meetings) | #Goals (3 meetings)

---

*Generated from 12 meeting note files*
*Excluded 5 completed action items*
```

### CLI Usage

```bash
# Generate comprehensive insights report
npm run aggregate-insights

# Generate only action items (existing functionality)
npm run aggregate-actions

# Custom output location
npm run aggregate-insights -- --output ~/Desktop/insights.md

# Custom date range
npm run aggregate-insights -- --since 2026-03-01 --until 2026-03-20
```

### Integration Points

- **Source**: `**/ZZ_Raw/**/*- Summary and Actions.md` files
- **Action Items Output**: `ZZ_Raw/action-items-summary-{MM-DD}.md` (existing)
- **Insights Report Output**: `ZZ_Raw/meeting-insights-{MM-DD}.md` (new)
- **Format**: Markdown with WikiLinks to source files
- **Scheduling**: Can be run manually or added to a cron job

## Implementation Plan

### Phase 1: Action Items Aggregator (✅ Complete)

**File**: `src/aggregate-actions.ts` (230 lines)

Core functionality:
- Extract action items from "Action Items" sections
- Filter completed items (Done), (done), [X], [x]
- Group by source meeting
- Generate action-items-summary-MM-DD.md

**Status**: Implemented, tested (6/6 tests passing), deployed

### Phase 2: Meeting Insights Aggregator (New)

**File**: `src/aggregate-insights.ts` (~400 lines)

New functionality:
- Reuse action items extraction from Phase 1
- Extract all sections from summary files:
  - Summary paragraphs
  - Key Learnings
  - Key Decisions
  - Tags
- Identify accomplishments from:
  - Completed action items (marked Done/[X])
  - Positive keywords in learnings ("achieved", "completed", "launched", "delivered", "success", "win")
  - Decisions that indicate completion ("finalized", "resolved", "approved")
- Generate comprehensive meeting digest grouped by week
- Calculate statistics (meeting count, action completion rate, trending tags)
- Format rich insights report

```typescript
interface MeetingInsight {
  meetingName: string;
  date: Date;
  filePath: string;
  summary: string;
  actionItems: ActionItem[];
  learnings: string[];
  decisions: string[];
  tags: string[];
  accomplishments: Accomplishment[];
}

interface Accomplishment {
  text: string;
  type: 'completed_action' | 'achievement' | 'decision';
  sourceFile: string;
  confidence: 'high' | 'medium' | 'low';
}

async function extractMeetingInsights(filePath: string): Promise<MeetingInsight>

function identifyAccomplishments(insight: MeetingInsight): Accomplishment[]

function generateInsightsReport(
  insights: MeetingInsight[],
  metadata: ReportMetadata
): string

function groupByWeek(insights: MeetingInsight[]): Map<string, MeetingInsight[]>

function extractTrendingTags(insights: MeetingInsight[]): Map<string, number>
```

### 1. Core Insights Extraction (~200 lines)

### 1. Core Insights Extraction (~200 lines)

**New functions:**
- `extractMeetingInsights(filePath)`: Parse all sections from a summary file
- `extractSection(content, headerName)`: Generic section extractor for any header
- `identifyAccomplishments(insight)`: Detect achievements using keyword matching and completed actions
- `parseMeetingDate(filename)`: Extract date from filename (e.g., "Cosine 02-26" → Feb 26, 2026)
- `groupByWeek(insights)`: Group meetings by calendar week
- `extractTrendingTags(insights)`: Count tag frequency across all meetings

### 2. Accomplishment Detection (~100 lines)

**Keyword patterns for accomplishments:**
- Completed actions: `(Done)`, `[X]`, `[x]`
- Achievement keywords: "achieved", "completed", "finished", "launched", "delivered", "shipped", "success", "won", "closed"
- Decision keywords: "finalized", "resolved", "approved", "agreed", "decided", "confirmed"

**Confidence scoring:**
- **High**: Explicitly completed action items, clear achievement language
- **Medium**: Decision keywords, positive progress indicators
- **Low**: Inferred from context, ambiguous phrasing

### 3. Report Generation (~100 lines)

**Output structure:**
1. Overview: Statistics and date range
2. Pending Action Items (existing functionality)
3. Accomplishments & Wins (new)
4. Meeting Digest (new) - grouped by week
5. Key Learnings (new) - aggregated across meetings
6. Key Decisions (new) - aggregated across meetings
7. Trending Topics (new) - tag frequency analysis

### 4. Package Scripts

**File**: `package.json`

```json
{
  "scripts": {
    "aggregate-actions": "npx tsx src/aggregate-actions.ts",
    "aggregate-insights": "npx tsx src/aggregate-insights.ts"
  }
}
```

### 5. Configuration

Add to `handwriting-reference.json` (optional):

```json
{
  "aggregation": {
    "enabled": true,
    "completedMarkers": ["(Done)", "(done)", "[X]", "[x]"],
    "accomplishmentKeywords": {
      "achievement": ["achieved", "completed", "finished", "launched", "delivered", "shipped", "success", "won"],
      "decision": ["finalized", "resolved", "approved", "agreed", "decided", "confirmed"]
    },
    "outputFolder": "/Users/I566809/Library/CloudStorage/OneDrive-SAPSE/Notes/ZZ_Raw"
  }
}
```

### 6. Test Suite Extension

**New file**: `tests/meeting-insights.test.ts` (~15 tests)

New tests:
- Extract all sections from summary files
- Identify accomplishments from completed actions
- Identify accomplishments from achievement keywords
- Group meetings by week correctly
- Calculate tag frequency
- Format comprehensive report
- Handle date parsing from filenames
- Handle missing sections gracefully
- Parse meeting date ranges correctly

**Existing**: `tests/action-aggregation.test.ts` (6 tests) - remains unchanged

## Success Metrics

### Phase 1 (✅ Complete)
- **Accuracy**: 100% of non-completed action items extracted
- **Precision**: 0% false positives (completed items excluded)
- **Performance**: <2s for 50 meeting files
- **Test coverage**: 6/6 tests passing
- **Real data**: 11 pending items from 12 meetings

### Phase 2 (New - Meeting Insights)
- **Section extraction accuracy**: 95%+ for all summary sections
- **Accomplishment detection**: 80%+ of real accomplishments identified
- **False positive rate**: <15% for accomplishments
- **Performance**: <5s for 50 meeting files (all sections)
- **Usability**: Single command generates comprehensive report
- **Value**: Saves 15-20 minutes of manual review weekly

## Risks and Mitigations

**Risk**: Action items format varies across files
**Mitigation**: ✅ Addressed - Flexible parsing handles variations

**Risk**: Accomplishment detection may have false positives
**Mitigation**: Use confidence scoring, require keyword+context match, allow manual review

**Risk**: Large meeting history could be slow
**Mitigation**: Add date range filtering, parallel file reading, cache parsed results

**Risk**: Summary quality varies across meetings
**Mitigation**: Handle missing sections gracefully, provide "No data" placeholders

## Future Enhancements

### Near-term (Phase 3)
- Automatic scheduling (run weekly via cron)
- Date range filtering (--since, --until)
- Diff view showing changes from previous report
- Export to other formats (CSV, JSON)

### Long-term (Phase 4)
- Priority tagging based on age or keywords
- Integration with task management tools (GitHub Issues, Jira)
- Sentiment analysis for team morale tracking
- AI-powered theme detection across meetings
- Slack/email integration for weekly digest distribution
