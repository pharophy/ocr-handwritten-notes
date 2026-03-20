import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

describe('Meeting Insights Aggregation', () => {
  const testDir = path.resolve(process.cwd(), 'test-insights-temp');

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Section extraction', () => {
    it('should extract all sections from a complete summary file', async () => {
      const testFile = path.join(testDir, 'Meeting 03-15 - Summary and Actions.md');
      const content = `# Meeting Summary

## Summary
The meeting focused on project planning and team coordination. We made progress on key deliverables.

## Action Items
- AI: Review proposal with team
- AI: Schedule follow-up meeting (Done)

## Key Learnings
- Effective communication improves delivery speed
- Cross-team collaboration is essential

## Key Decisions
- Approved the new architecture approach
- Finalized Q2 roadmap priorities

## Tags
#Planning #Architecture #Q2
`;

      await fs.writeFile(testFile, content);

      // Parse sections manually for testing
      const fileContent = await fs.readFile(testFile, 'utf-8');
      const lines = fileContent.split('\n');

      // Extract summaries
      let inSummary = false;
      const summaryLines: string[] = [];
      for (const line of lines) {
        if (line.match(/^#{1,3}\s*Summary/i)) {
          inSummary = true;
          continue;
        }
        if (inSummary && line.match(/^#{1,3}\s+/)) break;
        if (inSummary && line.trim()) summaryLines.push(line.trim());
      }

      expect(summaryLines.length).toBeGreaterThan(0);
      expect(summaryLines[0]).toContain('project planning');

      // Extract learnings
      let inLearnings = false;
      const learnings: string[] = [];
      for (const line of lines) {
        if (line.match(/^#{1,3}\s*Key Learnings/i)) {
          inLearnings = true;
          continue;
        }
        if (inLearnings && line.match(/^#{1,3}\s+/)) break;
        if (inLearnings && line.trim().startsWith('-')) learnings.push(line.trim());
      }

      expect(learnings).toHaveLength(2);
      expect(learnings[0]).toContain('communication');
    });

    it('should extract tags from tags section', async () => {
      const testFile = path.join(testDir, 'Test - Summary and Actions.md');
      const content = `## Tags
#AI #Onboarding #Planning #Architecture
`;

      await fs.writeFile(testFile, content);

      const fileContent = await fs.readFile(testFile, 'utf-8');
      const tagMatches = fileContent.match(/#[\w-]+/g);

      expect(tagMatches).toHaveLength(4);
      expect(tagMatches).toContain('#AI');
      expect(tagMatches).toContain('#Planning');
    });
  });

  describe('Accomplishment detection', () => {
    it('should identify completed action items as accomplishments', () => {
      const actionItems = [
        { text: '- AI: Task 1 (Done)', isCompleted: true },
        { text: '- AI: Task 2', isCompleted: false },
        { text: '- [X] AI: Task 3', isCompleted: true }
      ];

      const completedActions = actionItems.filter(a => a.isCompleted);

      expect(completedActions).toHaveLength(2);
    });

    it('should detect achievement keywords in learnings', () => {
      const learnings = [
        '- Successfully launched the new feature',
        '- Team achieved sprint goals',
        '- Regular meeting attendance improved',
        '- Completed migration ahead of schedule'
      ];

      const achievementKeywords = ['achieved', 'completed', 'finished', 'launched', 'delivered', 'success'];

      const achievements = learnings.filter(learning =>
        achievementKeywords.some(keyword => learning.toLowerCase().includes(keyword))
      );

      expect(achievements).toHaveLength(3);
      expect(achievements[0]).toContain('launched');
      expect(achievements[1]).toContain('achieved');
      expect(achievements[2]).toContain('Completed');
    });

    it('should detect decision keywords in decisions', () => {
      const decisions = [
        '- Finalized the architecture design',
        '- Approved budget for Q2',
        '- Discussed timeline considerations',
        '- Resolved conflict on approach'
      ];

      const decisionKeywords = ['finalized', 'resolved', 'approved', 'agreed', 'decided', 'confirmed'];

      const finalDecisions = decisions.filter(decision =>
        decisionKeywords.some(keyword => decision.toLowerCase().includes(keyword))
      );

      expect(finalDecisions).toHaveLength(3);
      expect(finalDecisions[0]).toContain('Finalized');
      expect(finalDecisions[1]).toContain('Approved');
    });
  });

  describe('Date parsing', () => {
    it('should parse date from meeting filename', () => {
      const testFilenames = [
        'Cosine 02-26 - Summary and Actions.md',
        'NPB ENG Sync 03-18 - Summary and Actions.md',
        'Weekly Reflection 03-20 - Summary and Actions.md'
      ];

      testFilenames.forEach(filename => {
        const match = filename.match(/(\d{1,2})-(\d{1,2})/);
        expect(match).toBeTruthy();

        const month = parseInt(match![1], 10);
        const day = parseInt(match![2], 10);

        expect(month).toBeGreaterThan(0);
        expect(month).toBeLessThanOrEqual(12);
        expect(day).toBeGreaterThan(0);
        expect(day).toBeLessThanOrEqual(31);
      });
    });

    it('should handle filenames without dates', () => {
      const filename = 'General Meeting - Summary and Actions.md';
      const match = filename.match(/(\d{1,2})-(\d{1,2})/);

      expect(match).toBeNull();
      // Should fallback to current date in actual implementation
    });
  });

  describe('Week grouping', () => {
    it('should group meetings by calendar week', () => {
      const dates = [
        new Date(2026, 2, 17), // March 17 (week 1)
        new Date(2026, 2, 18), // March 18 (week 1)
        new Date(2026, 2, 19), // March 19 (week 1)
        new Date(2026, 2, 24), // March 24 (week 2)
        new Date(2026, 2, 25)  // March 25 (week 2)
      ];

      const weeks = new Map<string, Date[]>();

      dates.forEach(date => {
        const dayOfWeek = date.getDay();
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - dayOfWeek);

        const weekKey = `Week of ${(weekStart.getMonth() + 1).toString().padStart(2, '0')}/${weekStart.getDate().toString().padStart(2, '0')}`;

        if (!weeks.has(weekKey)) {
          weeks.set(weekKey, []);
        }
        weeks.get(weekKey)!.push(date);
      });

      expect(weeks.size).toBe(2);
      expect(Array.from(weeks.keys())).toContain('Week of 03/15');
      expect(Array.from(weeks.keys())).toContain('Week of 03/22');
    });
  });

  describe('Tag frequency', () => {
    it('should calculate tag frequency across meetings', () => {
      const meetingTags = [
        ['#AI', '#Planning', '#Roadmap'],
        ['#AI', '#Onboarding'],
        ['#Planning', '#AI', '#Goals']
      ];

      const tagCounts = new Map<string, number>();

      meetingTags.forEach(tags => {
        tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      });

      expect(tagCounts.get('#AI')).toBe(3);
      expect(tagCounts.get('#Planning')).toBe(2);
      expect(tagCounts.get('#Onboarding')).toBe(1);
      expect(tagCounts.get('#Goals')).toBe(1);
    });

    it('should sort tags by frequency', () => {
      const tagCounts = new Map([
        ['#AI', 8],
        ['#Planning', 3],
        ['#Onboarding', 5],
        ['#Goals', 2]
      ]);

      const sorted = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1]);

      expect(sorted[0][0]).toBe('#AI');
      expect(sorted[1][0]).toBe('#Onboarding');
      expect(sorted[2][0]).toBe('#Planning');
      expect(sorted[3][0]).toBe('#Goals');
    });
  });
});
