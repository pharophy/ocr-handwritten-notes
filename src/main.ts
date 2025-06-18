import fs from 'fs/promises';
import path from 'path';
import { processHandwrittenImage } from './ocr';
import { summarizeText } from './summarize';
import { getAllImageFiles, fileExists } from './utils';
import dotenv from 'dotenv';
dotenv.config();

const MONITORED_FOLDERS = [path.resolve('/Users/I566809/Library/CloudStorage/OneDrive-SAPSE/Notes/ZZ_Raw')];

async function run() {
  // const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const folderPath of MONITORED_FOLDERS) {
    const imageFiles = await getAllImageFiles(folderPath);

    for (const imagePath of imageFiles) {
      const baseName = path.basename(imagePath, path.extname(imagePath));
      const folder = path.dirname(imagePath);
      const textFilePath = path.join(folder, `${baseName}.md`);
      const summaryFilePath = path.join(folder, `${baseName} - Summary and Actions.md`);

      if (await fileExists(textFilePath) || await fileExists(summaryFilePath)) {
        console.log(`⏭ Skipping ${imagePath} — already processed.`);
        continue;
      }

      const buffer = await fs.readFile(imagePath);
      const ocrText = await processHandwrittenImage(buffer, path.basename(imagePath));
      if (!ocrText) continue;

      const ocrOutput = `[[${path.basename(summaryFilePath)}]] | [[${path.basename(imagePath)}]]\n${ocrText}`;
      await fs.writeFile(textFilePath, ocrOutput, 'utf8');

      if (!textFilePath.includes('_nosum')) {
        const summary = await summarizeText(ocrOutput);
        const summaryOutput = `[[${path.basename(textFilePath)}]] | [[${path.basename(imagePath)}]]\n${summary}`;
        await fs.writeFile(summaryFilePath, summaryOutput, 'utf8');
      }

      console.log(`✅ Processed ${imagePath}`);
    }
  }
}

run().catch(err => console.error('❌ Error:', err));
