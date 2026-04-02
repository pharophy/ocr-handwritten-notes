import fs from 'fs/promises';
import path from 'path';

export async function getAllImageFiles(dir: string/*, since: number*/): Promise<string[]> {
  let results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(await getAllImageFiles(fullPath/*, since*/));
    } else if (/\.(jpe?g|png)$/i.test(entry.name)) {
      const stats = await fs.stat(fullPath);
      // if (stats.birthtimeMs > since) results.push(fullPath);
      results.push(fullPath);
    }
  }

  return results;
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
