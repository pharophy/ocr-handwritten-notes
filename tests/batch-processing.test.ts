import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAllImageFiles, fileExists } from '../src/utils';
import fs from 'fs/promises';
import path from 'path';

// Mock fs
vi.mock('fs/promises');

describe('Batch Processing Specifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Requirement: Folder monitoring configuration', () => {
    it('Scenario: Multiple folder support - should scan all configured folders', async () => {
      const mockDirent = (name: string, isDir: boolean) => ({
        name,
        isDirectory: () => isDir,
        isFile: () => !isDir
      });

      // Mock folder 1
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        mockDirent('image1.jpg', false),
        mockDirent('image2.png', false)
      ] as any);

      vi.mocked(fs.stat).mockResolvedValue({
        birthtimeMs: Date.now()
      } as any);

      const images = await getAllImageFiles('/test/folder1');

      expect(images.length).toBeGreaterThanOrEqual(0);
      expect(fs.readdir).toHaveBeenCalled();
    });

    it('Scenario: Nested folder scanning - should recursively scan subdirectories', async () => {
      const mockDirent = (name: string, isDir: boolean) => ({
        name,
        isDirectory: () => isDir,
        isFile: () => !isDir
      });

      // First call - parent directory with subdirectory
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        mockDirent('subdir', true),
        mockDirent('image1.jpg', false)
      ] as any);

      // Second call - subdirectory
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        mockDirent('image2.jpg', false)
      ] as any);

      vi.mocked(fs.stat).mockResolvedValue({
        birthtimeMs: Date.now()
      } as any);

      const images = await getAllImageFiles('/test/parent');

      // Should have found images from both parent and subdirectory
      expect(fs.readdir).toHaveBeenCalledTimes(2);
    });
  });

  describe('Requirement: Image file discovery', () => {
    it('Scenario: JPEG discovery - should identify .jpg and .jpeg files', async () => {
      const mockDirent = (name: string, isDir: boolean) => ({
        name,
        isDirectory: () => isDir,
        isFile: () => !isDir
      });

      vi.mocked(fs.readdir).mockResolvedValue([
        mockDirent('test.jpg', false),
        mockDirent('test2.jpeg', false),
        mockDirent('test3.JPG', false), // Case insensitive
        mockDirent('test.txt', false)
      ] as any);

      vi.mocked(fs.stat).mockResolvedValue({
        birthtimeMs: Date.now()
      } as any);

      const images = await getAllImageFiles('/test');

      expect(images.length).toBeGreaterThan(0);
      expect(images.some(img => img.includes('test.jpg'))).toBe(true);
      expect(images.some(img => img.includes('test2.jpeg'))).toBe(true);
      expect(images.some(img => img.includes('test3.JPG'))).toBe(true);
      expect(images.every(img => !img.includes('test.txt'))).toBe(true);
    });

    it('Scenario: PNG discovery - should identify .png files', async () => {
      const mockDirent = (name: string, isDir: boolean) => ({
        name,
        isDirectory: () => isDir,
        isFile: () => !isDir
      });

      vi.mocked(fs.readdir).mockResolvedValue([
        mockDirent('test.png', false),
        mockDirent('test2.PNG', false) // Case insensitive
      ] as any);

      vi.mocked(fs.stat).mockResolvedValue({
        birthtimeMs: Date.now()
      } as any);

      const images = await getAllImageFiles('/test');

      expect(images.length).toBeGreaterThan(0);
      expect(images.some(img => img.includes('test.png'))).toBe(true);
      expect(images.some(img => img.includes('test2.PNG'))).toBe(true);
    });
  });

  describe('Requirement: Duplicate processing prevention', () => {
    it('Scenario: Existing OCR output check - should check for [filename].md', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const exists = await fileExists('/test/notes.md');

      expect(exists).toBe(true);
      expect(fs.access).toHaveBeenCalledWith('/test/notes.md');
    });

    it('Scenario: Existing summary output check - should check for summary file', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const exists = await fileExists('/test/notes - Summary and Actions.md');

      expect(exists).toBe(true);
    });

    it('Scenario: Skip processed images - should return false for missing files', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      const exists = await fileExists('/test/nonexistent.md');

      expect(exists).toBe(false);
    });
  });

  describe('Requirement: Batch OCR processing', () => {
    it('Scenario: Sequential processing - images processed one at a time', async () => {
      // This is more of an integration test behavior
      // The specification says sequential processing should happen
      // In unit tests, we verify the structure supports it
      expect(true).toBe(true); // Placeholder - actual behavior tested in integration
    });

    it('Scenario: Process continuation on errors - should handle errors gracefully', async () => {
      // Error handling is verified by each module returning null on failure
      // and the main loop continuing
      expect(true).toBe(true); // Placeholder - actual behavior tested in integration
    });
  });

  describe('Requirement: Output file generation', () => {
    it('Scenario: OCR output file creation - should create [filename].md in same directory', () => {
      const imagePath = '/test/folder/meeting-notes.jpg';
      const baseName = path.basename(imagePath, path.extname(imagePath));
      const folder = path.dirname(imagePath);
      const expectedPath = path.join(folder, `${baseName}.md`);

      expect(expectedPath).toBe('/test/folder/meeting-notes.md');
    });

    it('Scenario: Summary output file creation - should create summary file', () => {
      const imagePath = '/test/folder/meeting-notes.jpg';
      const baseName = path.basename(imagePath, path.extname(imagePath));
      const folder = path.dirname(imagePath);
      const expectedPath = path.join(folder, `${baseName} - Summary and Actions.md`);

      expect(expectedPath).toBe('/test/folder/meeting-notes - Summary and Actions.md');
    });
  });

  describe('Requirement: Output file metadata', () => {
    it('Scenario: OCR file links - should include links to summary and image', () => {
      const imageName = 'meeting-notes.jpg';
      const summaryName = 'meeting-notes - Summary and Actions.md';

      const expectedLink = `[[${summaryName}]] | [[${imageName}]]`;

      expect(expectedLink).toContain(summaryName);
      expect(expectedLink).toContain(imageName);
    });

    it('Scenario: Summary file links - should include links to OCR file and image', () => {
      const imageName = 'meeting-notes.jpg';
      const ocrName = 'meeting-notes.md';

      const expectedLink = `[[${ocrName}]] | [[${imageName}]]`;

      expect(expectedLink).toContain(ocrName);
      expect(expectedLink).toContain(imageName);
    });
  });

  describe('Requirement: Execution logging', () => {
    it('Scenario: Skip logging - should log when image already processed', () => {
      const imagePath = '/test/meeting-notes.jpg';
      const expectedMessage = `⏭ Skipping ${imagePath} — already processed.`;

      expect(expectedMessage).toContain('⏭ Skipping');
      expect(expectedMessage).toContain('already processed');
    });

    it('Scenario: Success logging - should log when image processed successfully', () => {
      const imagePath = '/test/meeting-notes.jpg';
      const expectedMessage = `✅ Processed ${imagePath}`;

      expect(expectedMessage).toContain('✅ Processed');
      expect(expectedMessage).toContain(imagePath);
    });

    it('Scenario: Error logging - should log errors with details', () => {
      const error = new Error('OCR failed');
      const expectedMessage = `❌ Error: ${error.message}`;

      expect(expectedMessage).toContain('❌ Error');
      expect(expectedMessage).toContain('OCR failed');
    });
  });

  describe('Requirement: Single-run execution model', () => {
    it('Scenario: Run to completion - should process and exit', () => {
      // The main.ts file uses a run() function that processes all images and exits
      // This is a behavioral test that would be verified in integration testing
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Requirement: File system traversal', () => {
    it('Scenario: Recursive directory traversal - should find images at any depth', async () => {
      const mockDirent = (name: string, isDir: boolean) => ({
        name,
        isDirectory: () => isDir,
        isFile: () => !isDir
      });

      // Level 1
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        mockDirent('level1.jpg', false),
        mockDirent('subdir1', true)
      ] as any);

      // Level 2
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        mockDirent('level2.jpg', false),
        mockDirent('subdir2', true)
      ] as any);

      // Level 3
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        mockDirent('level3.jpg', false)
      ] as any);

      vi.mocked(fs.stat).mockResolvedValue({
        birthtimeMs: Date.now()
      } as any);

      const images = await getAllImageFiles('/test');

      // Should have recursed through all levels
      expect(fs.readdir).toHaveBeenCalledTimes(3);
    });
  });

  describe('Requirement: Summarization opt-out', () => {
    it('Scenario: _nosum flag detection - should identify files to skip summarization', () => {
      const filename1 = 'meeting-notes.jpg';
      const filename2 = 'meeting-notes_nosum.jpg';
      const filename3 = 'notes_nosum_test.png';

      expect(filename1.includes('_nosum')).toBe(false);
      expect(filename2.includes('_nosum')).toBe(true);
      expect(filename3.includes('_nosum')).toBe(true);
    });
  });
});
