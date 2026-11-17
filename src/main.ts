import { getAllImageFiles, fileExists } from './utils';
import { getMonitoredFolders } from './config';
import { processImageFile, outputPaths } from './pipeline';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  for (const folderPath of getMonitoredFolders()) {
    const imageFiles = await getAllImageFiles(folderPath);

    for (const imagePath of imageFiles) {
      const { ocrPath, summaryPath } = outputPaths(imagePath);

      if (await fileExists(ocrPath) || await fileExists(summaryPath)) {
        console.log(`⏭ Skipping ${imagePath} — already processed.`);
        continue;
      }

      const result = await processImageFile(imagePath, { validation: 'config', correction: true, summarize: true });
      if (!result) continue;

      console.log(`✅ Processed ${imagePath}`);
    }
  }
}

run().catch(err => console.error('❌ Error:', err));
