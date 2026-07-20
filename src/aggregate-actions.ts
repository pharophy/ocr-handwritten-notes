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
}

interface AggregationMetadata {
  generatedDate: string;
  totalItems: number;
  filesScanned: number;
  itemsExcluded: number;
}

const MONITORED_FOLDER = getPrimaryMonitoredFolder();
const COMPLETED_MARKERS = ['(Done)', '(done)', '[X]', '[x]'];

/**
 * Extract action items from a Summary and Actions markdown file
 */
async function extractActionItems(filePath: string): Promise<ActionItem[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // Find the "Action Items" section
    let inActionSection = false;
    const items: ActionItem[] = [];

    for (const line of lines) {
      // Check if we're entering the Action Items section
      if (line.match(/^#{1,3}\s*Action Items/i)) {
        inActionSection = true;
        continue;
      }

      // Exit action section if we hit another header
      if (inActionSection && line.match(/^#{1,3}\s+/)) {
        break;
      }

      // Extract action items (bullet points in action section)
      if (inActionSection && line.trim().startsWith('-')) {
        const itemText = line.trim();

        // Skip if it's a sub-bullet or empty
        if (itemText.length <= 1) continue;

        items.push({
          text: itemText,
          sourceFile: filePath,
          meetingName: extractMeetingName(filePath)
        });
      }
    }

    return items;
  } catch (error: any) {
    console.warn(`⚠️  Could not read ${filePath}: ${error.message}`);
    return [];
  }
}

/**
 * Extract meeting name from file path
 */
function extractMeetingName(filePath: string): string {
  const basename = path.basename(filePath);
  // Remove " - Summary and Actions.md" suffix
  return basename.replace(/\s*-?\s*Summary and Actions\.md$/i, '');
}

/**
 * Check if an action item is marked as completed
 */
function isCompleted(itemText: string): boolean {
  return COMPLETED_MARKERS.some(marker => itemText.includes(marker));
}

/**
 * Filter out completed action items
 */
function filterActiveItems(items: ActionItem[]): ActionItem[] {
  return items.filter(item => !isCompleted(item.text));
}

/**
 * Format aggregated action items as markdown
 */
function formatOutput(
  items: ActionItem[],
  metadata: AggregationMetadata
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Action Items Summary - Generated ${metadata.generatedDate}`);
  lines.push('');
  lines.push(`Total pending action items: **${metadata.totalItems}**`);
  lines.push('');

  if (items.length === 0) {
    lines.push('🎉 No pending action items found!');
    lines.push('');
    return lines.join('\n');
  }

  // Group by source file
  const grouped = groupBySourceFile(items);

  for (const [meetingName, meetingItems] of Object.entries(grouped)) {
    lines.push(`## From ${meetingName}`);
    meetingItems.forEach(item => {
      lines.push(item.text);
    });
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(`*Generated from ${metadata.filesScanned} meeting note files*`);
  if (metadata.itemsExcluded > 0) {
    lines.push(`*Excluded ${metadata.itemsExcluded} completed items marked (Done) or [X]*`);
  }

  return lines.join('\n');
}

/**
 * Group action items by source file
 */
function groupBySourceFile(items: ActionItem[]): Record<string, ActionItem[]> {
  const grouped: Record<string, ActionItem[]> = {};

  for (const item of items) {
    if (!grouped[item.meetingName]) {
      grouped[item.meetingName] = [];
    }
    grouped[item.meetingName].push(item);
  }

  return grouped;
}

/**
 * Get all "Summary and Actions.md" files in the monitored folder
 */
async function getSummaryFiles(folderPath: string): Promise<string[]> {
  const summaryFiles: string[] = [];

  async function scanDirectory(dirPath: string) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await scanDirectory(fullPath);
      } else if (entry.name.match(/Summary and Actions\.md$/i)) {
        summaryFiles.push(fullPath);
      }
    }
  }

  await scanDirectory(folderPath);
  return summaryFiles;
}

/**
 * Main function - aggregate action items
 */
async function aggregateActionItems() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run aggregate-actions [--output <path>]

Aggregates all pending action items from meeting notes in the configured monitored folder.

Options:
  --output <path>    Custom output file path (default: monitored folder/action-items-summary-MM-DD.md)
  --help, -h         Show this help message

Examples:
  npm run aggregate-actions
  npm run aggregate-actions -- --output ~/Desktop/actions.md
    `);
    process.exit(0);
  }

  console.log('📋 Aggregating action items...');
  console.log('');

  // Get output path
  const outputIndex = args.indexOf('--output');
  const today = new Date();
  const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const defaultOutput = path.join(MONITORED_FOLDER, `action-items-summary-${dateStr}.md`);
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

    // Extract all action items
    const allItems: ActionItem[] = [];
    for (const file of summaryFiles) {
      const items = await extractActionItems(file);
      allItems.push(...items);
    }

    console.log(`📝 Extracted ${allItems.length} total action items`);

    // Filter out completed items
    const activeItems = filterActiveItems(allItems);
    const excludedCount = allItems.length - activeItems.length;

    console.log(`   ${activeItems.length} pending`);
    if (excludedCount > 0) {
      console.log(`   ${excludedCount} completed (excluded)`);
    }
    console.log('');

    // Format output
    const metadata: AggregationMetadata = {
      generatedDate: today.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      totalItems: activeItems.length,
      filesScanned: summaryFiles.length,
      itemsExcluded: excludedCount
    };

    const output = formatOutput(activeItems, metadata);

    // Write output file
    await fs.writeFile(outputPath, output, 'utf-8');

    console.log(`✅ Action items summary: ${outputPath}`);
    console.log('');
    console.log('✨ Done!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

aggregateActionItems();
