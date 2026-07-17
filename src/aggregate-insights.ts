#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { getPrimaryMonitoredFolder } from './config';

dotenv.config();

interface ActionItem {
  text: string;
  sourceFile: string;
  meetingName: string;
  isCompleted: boolean;
}

interface Accomplishment {
  text: string;
  type: 'completed_action' | 'achievement' | 'decision';
  sourceFile: string;
  meetingName: string;
  confidence: 'high' | 'medium' | 'low';
}

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

interface ReportMetadata {
  generatedDate: string;
  meetingCount: number;
  dateRange: string;
  totalActions: number;
  completedActions: number;
  pendingActions: number;
  accomplishmentCount: number;
}

const MONITORED_FOLDER = getPrimaryMonitoredFolder();
const COMPLETED_MARKERS = ['(Done)', '(done)', '[X]', '[x]'];
const ACHIEVEMENT_KEYWORDS = ['achieved', 'completed', 'finished', 'launched', 'delivered', 'shipped', 'success', 'successful', 'won', 'closed'];
const DECISION_KEYWORDS = ['finalized', 'resolved', 'approved', 'agreed', 'decided', 'confirmed'];

/**
 * Parse meeting date from filename
 */
function parseMeetingDate(filename: string): Date {
  // Try to extract date from filename like "Cosine 02-26" or "Meeting 03-17"
  const match = filename.match(/(\d{1,2})-(\d{1,2})/);

  if (match) {
    const month = parseInt(match[1], 10) - 1; // 0-indexed
    const day = parseInt(match[2], 10);
    const year = new Date().getFullYear();
    return new Date(year, month, day);
  }

  // Fallback to current date if no date in filename
  return new Date();
}

/**
 * Extract a section from markdown content
 */
function extractSection(content: string, headerPattern: RegExp): string[] {
  const lines = content.split('\n');
  let inSection = false;
  const sectionLines: string[] = [];

  for (const line of lines) {
    // Check if entering target section
    if (line.match(headerPattern)) {
      inSection = true;
      continue;
    }

    // Exit section if we hit another header
    if (inSection && line.match(/^#{1,3}\s+/)) {
      break;
    }

    // Collect content in section
    if (inSection && line.trim().length > 0) {
      sectionLines.push(line.trim());
    }
  }

  return sectionLines;
}

/**
 * Check if text is marked as completed
 */
function isCompleted(text: string): boolean {
  return COMPLETED_MARKERS.some(marker => text.includes(marker));
}

/**
 * Extract meeting insights from a Summary and Actions file
 */
async function extractMeetingInsights(filePath: string): Promise<MeetingInsight | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const meetingName = path.basename(filePath).replace(/\s*-?\s*Summary and Actions\.md$/i, '');
    const date = parseMeetingDate(meetingName);

    // Extract all sections
    const summaryLines = extractSection(content, /^#{1,3}\s*Summary/i);
    const actionLines = extractSection(content, /^#{1,3}\s*Action Items/i);
    const learningLines = extractSection(content, /^#{1,3}\s*Key Learnings/i);
    const decisionLines = extractSection(content, /^#{1,3}\s*Key Decisions/i);
    const tagLines = extractSection(content, /^#{1,3}\s*Tags/i);

    // Parse action items
    const actionItems: ActionItem[] = actionLines
      .filter(line => line.startsWith('-'))
      .map(line => ({
        text: line,
        sourceFile: filePath,
        meetingName,
        isCompleted: isCompleted(line)
      }));

    // Create insight object
    const insight: MeetingInsight = {
      meetingName,
      date,
      filePath,
      summary: summaryLines.join(' '),
      actionItems,
      learnings: learningLines.filter(line => line.startsWith('-')),
      decisions: decisionLines.filter(line => line.startsWith('-')),
      tags: extractTags(tagLines),
      accomplishments: []
    };

    // Identify accomplishments
    insight.accomplishments = identifyAccomplishments(insight);

    return insight;
  } catch (error: any) {
    console.warn(`⚠️  Could not read ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Extract individual tags from tag lines
 */
function extractTags(tagLines: string[]): string[] {
  const tags: string[] = [];

  for (const line of tagLines) {
    // Extract hashtags
    const matches = line.match(/#[\w-]+/g);
    if (matches) {
      tags.push(...matches);
    }
  }

  return tags;
}

/**
 * Identify accomplishments from meeting insights
 */
function identifyAccomplishments(insight: MeetingInsight): Accomplishment[] {
  const accomplishments: Accomplishment[] = [];

  // 1. Completed action items (high confidence)
  const completedActions = insight.actionItems.filter(item => item.isCompleted);
  completedActions.forEach(item => {
    accomplishments.push({
      text: item.text.replace(/\s*\(Done\)\s*/gi, '').replace(/\s*\[X\]\s*/gi, '').replace(/\s*\[x\]\s*/gi, ''),
      type: 'completed_action',
      sourceFile: item.sourceFile,
      meetingName: insight.meetingName,
      confidence: 'high'
    });
  });

  // 2. Achievement keywords in learnings (medium confidence)
  insight.learnings.forEach(learning => {
    const hasAchievement = ACHIEVEMENT_KEYWORDS.some(keyword =>
      learning.toLowerCase().includes(keyword)
    );

    if (hasAchievement) {
      accomplishments.push({
        text: learning,
        type: 'achievement',
        sourceFile: insight.filePath,
        meetingName: insight.meetingName,
        confidence: 'medium'
      });
    }
  });

  // 3. Decision keywords in decisions (medium confidence)
  insight.decisions.forEach(decision => {
    const hasDecisionKeyword = DECISION_KEYWORDS.some(keyword =>
      decision.toLowerCase().includes(keyword)
    );

    if (hasDecisionKeyword) {
      accomplishments.push({
        text: decision,
        type: 'decision',
        sourceFile: insight.filePath,
        meetingName: insight.meetingName,
        confidence: 'medium'
      });
    }
  });

  return accomplishments;
}

/**
 * Group meetings by calendar week
 */
function groupByWeek(insights: MeetingInsight[]): Map<string, MeetingInsight[]> {
  const weeks = new Map<string, MeetingInsight[]>();

  insights.forEach(insight => {
    // Get week start date (Sunday)
    const date = new Date(insight.date);
    const dayOfWeek = date.getDay();
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - dayOfWeek);

    const weekKey = `Week of ${(weekStart.getMonth() + 1).toString().padStart(2, '0')}/${weekStart.getDate().toString().padStart(2, '0')}`;

    if (!weeks.has(weekKey)) {
      weeks.set(weekKey, []);
    }
    weeks.get(weekKey)!.push(insight);
  });

  return weeks;
}

/**
 * Calculate tag frequency
 */
function calculateTagFrequency(insights: MeetingInsight[]): Map<string, number> {
  const tagCounts = new Map<string, number>();

  insights.forEach(insight => {
    insight.tags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  return tagCounts;
}

/**
 * Format comprehensive insights report
 */
function formatInsightsReport(insights: MeetingInsight[], metadata: ReportMetadata): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Meeting Insights Report - Generated ${metadata.generatedDate}`);
  lines.push('');

  // Overview
  lines.push('## 📊 Overview');
  lines.push(`- **Meetings analyzed**: ${metadata.meetingCount}`);
  lines.push(`- **Date range**: ${metadata.dateRange}`);
  lines.push(`- **Pending action items**: ${metadata.pendingActions}`);
  lines.push(`- **Completed actions**: ${metadata.completedActions}`);
  lines.push(`- **Accomplishments identified**: ${metadata.accomplishmentCount}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Pending Action Items
  lines.push('## 🎯 Pending Action Items');
  lines.push('');

  const pendingActions = insights.flatMap(i => i.actionItems.filter(a => !a.isCompleted));

  if (pendingActions.length === 0) {
    lines.push('🎉 No pending action items!');
  } else {
    const actionsByMeeting = new Map<string, ActionItem[]>();
    pendingActions.forEach(action => {
      if (!actionsByMeeting.has(action.meetingName)) {
        actionsByMeeting.set(action.meetingName, []);
      }
      actionsByMeeting.get(action.meetingName)!.push(action);
    });

    actionsByMeeting.forEach((actions, meetingName) => {
      lines.push(`### From ${meetingName}`);
      actions.forEach(action => lines.push(action.text));
      lines.push('');
    });
  }

  lines.push('---');
  lines.push('');

  // Accomplishments
  lines.push('## 🎉 Accomplishments & Wins');
  lines.push('');

  const allAccomplishments = insights.flatMap(i => i.accomplishments);

  if (allAccomplishments.length === 0) {
    lines.push('No accomplishments detected in this period.');
  } else {
    // Group by meeting
    const accomplishmentsByMeeting = new Map<string, Accomplishment[]>();
    allAccomplishments.forEach(acc => {
      if (!accomplishmentsByMeeting.has(acc.meetingName)) {
        accomplishmentsByMeeting.set(acc.meetingName, []);
      }
      accomplishmentsByMeeting.get(acc.meetingName)!.push(acc);
    });

    accomplishmentsByMeeting.forEach((accs, meetingName) => {
      lines.push(`### From ${meetingName}`);
      accs.forEach(acc => {
        const icon = acc.type === 'completed_action' ? '✅' :
                     acc.type === 'achievement' ? '🎯' : '🔑';
        lines.push(`${icon} ${acc.text}`);
      });
      lines.push('');
    });
  }

  lines.push('---');
  lines.push('');

  // Meeting Digest
  lines.push('## 📝 Meeting Digest');
  lines.push('');

  const weekGroups = groupByWeek(insights);

  // Sort weeks chronologically
  const sortedWeeks = Array.from(weekGroups.entries()).sort((a, b) => {
    const dateA = a[1][0].date;
    const dateB = b[1][0].date;
    return dateA.getTime() - dateB.getTime();
  });

  sortedWeeks.forEach(([weekLabel, weekInsights]) => {
    lines.push(`### ${weekLabel}`);

    weekInsights.forEach(insight => {
      if (insight.summary && insight.summary.length > 0) {
        lines.push(`**${insight.meetingName}**: ${insight.summary}`);
        lines.push('');
      }
    });
  });

  lines.push('---');
  lines.push('');

  // Key Learnings
  lines.push('## 💡 Key Learnings');
  lines.push('');

  const allLearnings = insights.flatMap(i => i.learnings);

  if (allLearnings.length === 0) {
    lines.push('No key learnings captured.');
  } else {
    allLearnings.forEach(learning => lines.push(learning));
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  // Key Decisions
  lines.push('## 🔑 Key Decisions');
  lines.push('');

  const allDecisions = insights.flatMap(i => i.decisions);

  if (allDecisions.length === 0) {
    lines.push('No key decisions recorded.');
  } else {
    allDecisions.forEach(decision => lines.push(decision));
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  // Trending Topics
  lines.push('## 🏷️ Trending Topics');
  lines.push('');

  const tagFrequency = calculateTagFrequency(insights);

  if (tagFrequency.size === 0) {
    lines.push('No tags found.');
  } else {
    // Sort by frequency
    const sortedTags = Array.from(tagFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10 tags

    const tagStrings = sortedTags.map(([tag, count]) => `${tag} (${count})`);
    lines.push(tagStrings.join(' | '));
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  // Footer
  lines.push(`*Generated from ${metadata.meetingCount} meeting note files*`);
  if (metadata.completedActions > 0) {
    lines.push(`*Identified ${metadata.accomplishmentCount} accomplishments*`);
  }

  return lines.join('\n');
}

/**
 * Get all "Summary and Actions.md" files in the monitored folder
 */
async function getSummaryFiles(folderPath: string): Promise<string[]> {
  const summaryFiles: string[] = [];

  async function scanDirectory(dirPath: string) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (entry.name.match(/Summary and Actions\.md$/i)) {
          summaryFiles.push(fullPath);
        }
      }
    } catch (error: any) {
      console.warn(`⚠️  Could not scan ${dirPath}: ${error.message}`);
    }
  }

  await scanDirectory(folderPath);
  return summaryFiles;
}

/**
 * Calculate date range string
 */
function calculateDateRange(insights: MeetingInsight[]): string {
  if (insights.length === 0) return 'N/A';

  const dates = insights.map(i => i.date).sort((a, b) => a.getTime() - b.getTime());
  const earliest = dates[0];
  const latest = dates[dates.length - 1];

  const format = (d: Date) => `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;

  if (earliest.getTime() === latest.getTime()) {
    return format(earliest);
  }

  return `${format(earliest)} - ${format(latest)}`;
}

/**
 * Main function - aggregate meeting insights
 */
async function aggregateMeetingInsights() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run aggregate-insights [--output <path>]

Aggregates comprehensive meeting insights including action items, accomplishments,
learnings, decisions, and trends from all meeting notes in the configured monitored folder.

Options:
  --output <path>    Custom output file path (default: monitored folder/meeting-insights-MM-DD.md)
  --help, -h         Show this help message

Examples:
  npm run aggregate-insights
  npm run aggregate-insights -- --output ~/Desktop/insights.md
    `);
    process.exit(0);
  }

  console.log('📋 Aggregating meeting insights...');
  console.log('');

  // Get output path
  const outputIndex = args.indexOf('--output');
  const today = new Date();
  const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const defaultOutput = path.join(MONITORED_FOLDER, `meeting-insights-${dateStr}.md`);
  const outputPath = outputIndex >= 0 && args[outputIndex + 1]
    ? path.resolve(args[outputIndex + 1])
    : defaultOutput;

  try {
    // Find all Summary and Actions files
    console.log(`🔍 Scanning: ${MONITORED_FOLDER}`);
    const summaryFiles = await getSummaryFiles(MONITORED_FOLDER);
    console.log(`   Found ${summaryFiles.length} summary files`);
    console.log('');

    if (summaryFiles.length === 0) {
      console.log('⚠️  No summary files found in monitored folder');
      process.exit(0);
    }

    // Extract insights from all files
    console.log('📊 Extracting insights...');
    const allInsights: MeetingInsight[] = [];

    for (const file of summaryFiles) {
      const insight = await extractMeetingInsights(file);
      if (insight) {
        allInsights.push(insight);
      }
    }

    // Sort by date
    allInsights.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate statistics
    const totalActions = allInsights.flatMap(i => i.actionItems).length;
    const completedActions = allInsights.flatMap(i => i.actionItems).filter(a => a.isCompleted).length;
    const pendingActions = totalActions - completedActions;
    const accomplishmentCount = allInsights.flatMap(i => i.accomplishments).length;

    console.log(`   ${allInsights.length} meetings analyzed`);
    console.log(`   ${totalActions} total action items (${pendingActions} pending, ${completedActions} completed)`);
    console.log(`   ${accomplishmentCount} accomplishments identified`);
    console.log('');

    // Build metadata
    const metadata: ReportMetadata = {
      generatedDate: today.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      meetingCount: allInsights.length,
      dateRange: calculateDateRange(allInsights),
      totalActions,
      completedActions,
      pendingActions,
      accomplishmentCount
    };

    // Format output
    const output = formatInsightsReport(allInsights, metadata);

    // Write output file
    await fs.writeFile(outputPath, output, 'utf-8');

    console.log(`✅ Meeting insights report: ${outputPath}`);
    console.log('');
    console.log('✨ Done!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

aggregateMeetingInsights();
