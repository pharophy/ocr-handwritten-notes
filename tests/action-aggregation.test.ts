import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Action Items Aggregation', () => {
  const testDir = path.resolve(process.cwd(), 'test-data-temp');

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Action item extraction', () => {
    it('should extract action items from summary file', async () => {
      const testFile = path.join(testDir, 'Meeting 01-01 - Summary and Actions.md');
      const content = `# Meeting Summary

## Action Items
- AI: Review proposal with team
- AI: Schedule follow-up meeting
- AI: Send report to stakeholders

## Key Learnings
- Important insight here
`;

      await fs.writeFile(testFile, content);

      // Run extraction manually (we'll test via import later)
      const fileContent = await fs.readFile(testFile, 'utf-8');
      const lines = fileContent.split('\n');

      let inActionSection = false;
      const items: string[] = [];

      for (const line of lines) {
        if (line.match(/^#{1,3}\s*Action Items/i)) {
          inActionSection = true;
          continue;
        }
        if (inActionSection && line.match(/^#{1,3}\s+/)) {
          break;
        }
        if (inActionSection && line.trim().startsWith('-')) {
          items.push(line.trim());
        }
      }

      expect(items).toHaveLength(3);
      expect(items[0]).toContain('Review proposal');
      expect(items[1]).toContain('Schedule follow-up');
      expect(items[2]).toContain('Send report');
    });

    it('should filter out completed items marked with (Done)', async () => {
      const testFile = path.join(testDir, 'Meeting 01-02 - Summary and Actions.md');
      const content = `## Action Items
- AI: Task 1 (Done)
- AI: Task 2
- AI: Task 3 (Done)
- AI: Task 4
`;

      await fs.writeFile(testFile, content);

      const fileContent = await fs.readFile(testFile, 'utf-8');
      const lines = fileContent.split('\n');

      let inActionSection = false;
      const items: string[] = [];

      for (const line of lines) {
        if (line.match(/^#{1,3}\s*Action Items/i)) {
          inActionSection = true;
          continue;
        }
        if (inActionSection && line.match(/^#{1,3}\s+/)) {
          break;
        }
        if (inActionSection && line.trim().startsWith('-')) {
          const item = line.trim();
          if (!item.includes('(Done)') && !item.includes('[X]') && !item.includes('[x]')) {
            items.push(item);
          }
        }
      }

      expect(items).toHaveLength(2);
      expect(items[0]).toContain('Task 2');
      expect(items[1]).toContain('Task 4');
    });

    it('should filter out completed items marked with [X]', async () => {
      const testFile = path.join(testDir, 'Meeting 01-03 - Summary and Actions.md');
      const content = `## Action Items
- [X] AI: Completed task 1
- AI: Pending task 2
- [x] AI: Completed task 3
- AI: Pending task 4
`;

      await fs.writeFile(testFile, content);

      const fileContent = await fs.readFile(testFile, 'utf-8');
      const lines = fileContent.split('\n');

      let inActionSection = false;
      const items: string[] = [];

      for (const line of lines) {
        if (line.match(/^#{1,3}\s*Action Items/i)) {
          inActionSection = true;
          continue;
        }
        if (inActionSection && line.match(/^#{1,3}\s+/)) {
          break;
        }
        if (inActionSection && line.trim().startsWith('-')) {
          const item = line.trim();
          if (!item.includes('(Done)') && !item.includes('[X]') && !item.includes('[x]')) {
            items.push(item);
          }
        }
      }

      expect(items).toHaveLength(2);
      expect(items[0]).toContain('Pending task 2');
      expect(items[1]).toContain('Pending task 4');
    });

    it('should handle files with no action items section', async () => {
      const testFile = path.join(testDir, 'Meeting 01-04 - Summary and Actions.md');
      const content = `# Meeting Summary

## Key Learnings
- Learning 1
- Learning 2

## Tags
#Meeting #Planning
`;

      await fs.writeFile(testFile, content);

      const fileContent = await fs.readFile(testFile, 'utf-8');
      const lines = fileContent.split('\n');

      let inActionSection = false;
      const items: string[] = [];

      for (const line of lines) {
        if (line.match(/^#{1,3}\s*Action Items/i)) {
          inActionSection = true;
          continue;
        }
        if (inActionSection && line.match(/^#{1,3}\s+/)) {
          break;
        }
        if (inActionSection && line.trim().startsWith('-')) {
          items.push(line.trim());
        }
      }

      expect(items).toHaveLength(0);
    });

    it('should handle empty action items section', async () => {
      const testFile = path.join(testDir, 'Meeting 01-05 - Summary and Actions.md');
      const content = `## Action Items

## Key Learnings
- Learning 1
`;

      await fs.writeFile(testFile, content);

      const fileContent = await fs.readFile(testFile, 'utf-8');
      const lines = fileContent.split('\n');

      let inActionSection = false;
      const items: string[] = [];

      for (const line of lines) {
        if (line.match(/^#{1,3}\s*Action Items/i)) {
          inActionSection = true;
          continue;
        }
        if (inActionSection && line.match(/^#{1,3}\s+/)) {
          break;
        }
        if (inActionSection && line.trim().startsWith('-')) {
          items.push(line.trim());
        }
      }

      expect(items).toHaveLength(0);
    });

    it('should extract meeting name from file path', () => {
      const testPaths = [
        '/path/to/Cosine 02-26 - Summary and Actions.md',
        '/path/to/NPB ENG Sync 03-18 - Summary and Actions.md',
        '/path/to/Weekly Reflection 03-20-Summary and Actions.md'
      ];

      const expected = [
        'Cosine 02-26',
        'NPB ENG Sync 03-18',
        'Weekly Reflection 03-20'
      ];

      testPaths.forEach((filePath, i) => {
        const basename = path.basename(filePath);
        const meetingName = basename.replace(/\s*-?\s*Summary and Actions\.md$/i, '');
        expect(meetingName).toBe(expected[i]);
      });
    });
  });
});
