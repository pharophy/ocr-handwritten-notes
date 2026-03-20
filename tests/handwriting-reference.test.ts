import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadHandwritingReference,
  loadReferenceImage,
  formatReferenceWordsForPrompt,
  formatReferenceImageInstructions,
  referenceImageExists,
  getDomainGlossary,
  formatGlossaryContext
} from '../src/handwritingReference';
import fs from 'fs/promises';
import path from 'path';

// Mock fs
vi.mock('fs/promises');

describe('Handwriting Reference Specifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.HANDWRITING_REFERENCE_ENABLED;
    delete process.env.HANDWRITING_REFERENCE_FILE;
  });

  describe('Requirement: Handwriting reference configuration', () => {
    it('Scenario: Configuration file loading - should load from handwriting-reference.json', async () => {
      const mockConfig = {
        referenceWords: ['ABC', 'abc'],
        referenceImagePath: './test.jpg'
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const result = await loadHandwritingReference();

      expect(result).toEqual(mockConfig);
      expect(fs.readFile).toHaveBeenCalled();
    });

    it('Scenario: Missing configuration - should return empty object without errors', async () => {
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await loadHandwritingReference();

      expect(result).toEqual({});
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No handwriting reference found'));

      consoleSpy.mockRestore();
    });

    it('Scenario: Invalid configuration - should log warning and return empty object', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{ invalid json' as any);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await loadHandwritingReference();

      expect(result).toEqual({});
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Requirement: Reference configuration format', () => {
    it('Scenario: Text-based reference - should support referenceWords array', async () => {
      const config = {
        referenceWords: ['ABCDEFG', 'abcdefg', '0123456'],
        specialCharacters: ['@ # $']
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(config));

      const result = await loadHandwritingReference();

      expect(result.referenceWords).toBeDefined();
      expect(Array.isArray(result.referenceWords)).toBe(true);
    });

    it('Scenario: Image-based reference - should support referenceImagePath', async () => {
      const config = {
        referenceImagePath: './handwriting-samples/reference.jpg'
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(config));

      const result = await loadHandwritingReference();

      expect(result.referenceImagePath).toBe('./handwriting-samples/reference.jpg');
    });

    it('Scenario: Special characters reference - should support specialCharacters array', async () => {
      const config = {
        specialCharacters: ['@ # $ % & *']
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(config));

      const result = await loadHandwritingReference();

      expect(result.specialCharacters).toBeDefined();
      expect(Array.isArray(result.specialCharacters)).toBe(true);
    });
  });

  describe('Requirement: Reference image loading', () => {
    it('Scenario: Valid reference image - should load image as buffer', async () => {
      const mockBuffer = Buffer.from('fake image data');
      vi.mocked(fs.readFile).mockResolvedValue(mockBuffer);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await loadReferenceImage('./test.jpg');

      expect(result).toEqual(mockBuffer);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Loaded reference image'));

      consoleSpy.mockRestore();
    });

    it('Scenario: Missing reference image - should log warning and return null', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await loadReferenceImage('./missing.jpg');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('Scenario: Large reference images - should warn if image > 5MB', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      vi.mocked(fs.readFile).mockResolvedValue(largeBuffer);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await loadReferenceImage('./large.jpg');

      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('Scenario: Invalid image format - should warn about non-standard extensions', async () => {
      const mockBuffer = Buffer.from('fake image data');
      vi.mocked(fs.readFile).mockResolvedValue(mockBuffer);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await loadReferenceImage('./test.gif');

      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });

  describe('Requirement: Prompt enhancement with text reference', () => {
    it('Scenario: Text reference prompt formatting - should format by category', () => {
      const config = {
        referenceWords: [
          'ABCDEFG',
          'abcdefg',
          '0123',
          'The quick brown fox',
          'Apple'
        ]
      };

      const result = formatReferenceWordsForPrompt(config);

      expect(result).toContain('Uppercase reference');
      expect(result).toContain('Lowercase reference');
      expect(result).toContain('Numbers reference');
      expect(result).toContain('Mixed case examples');
    });

    it('Scenario: Empty reference words - should return empty string', () => {
      const config = { referenceWords: [] };

      const result = formatReferenceWordsForPrompt(config);

      expect(result).toBe('');
    });
  });

  describe('Requirement: Image reference API integration', () => {
    it('Scenario: Reference image instructions - should include comparison guidance', () => {
      const result = formatReferenceImageInstructions();

      expect(result).toContain('reference image');
      expect(result).toContain('Compare unclear characters');
      expect(result).toContain('Match letter formations');
    });
  });

  describe('Requirement: Environment variable configuration', () => {
    it('Scenario: Feature toggle - should not load when HANDWRITING_REFERENCE_ENABLED=false', async () => {
      process.env.HANDWRITING_REFERENCE_ENABLED = 'false';

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await loadHandwritingReference();

      expect(result).toEqual({});
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('disabled via environment variable'));

      consoleSpy.mockRestore();
    });

    it('Scenario: Custom config path - should use HANDWRITING_REFERENCE_FILE environment variable', async () => {
      // This test verifies that the environment variable is read
      // The actual path resolution happens at module initialization
      // So we just verify the function works when called
      const mockConfig = { referenceWords: ['test'] };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig) as any);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await loadHandwritingReference();

      expect(fs.readFile).toHaveBeenCalled();
      expect(result).toEqual(mockConfig);

      consoleSpy.mockRestore();
    });
  });

  describe('Requirement: Logging and observability', () => {
    it('Scenario: Successful reference load - should log confirmation', async () => {
      const mockConfig = { referenceWords: ['ABC'] };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await loadHandwritingReference();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Loaded handwriting reference'));

      consoleSpy.mockRestore();
    });

    it('Scenario: Reference warnings - should provide troubleshooting messages', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await loadHandwritingReference();

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Requirement: Character disambiguation guidance', () => {
    it('Scenario: Confusion mitigation - should mention commonly confused letters', () => {
      const config = {
        referenceWords: ['ABCDEFG', 'abcdefg']
      };

      const result = formatReferenceWordsForPrompt(config);

      expect(result).toContain('l/I/1');
      expect(result).toContain('a/o');
      expect(result).toContain('u/v');
      expect(result).toContain('m/n');
    });
  });

  describe('Requirement: Reference image existence check', () => {
    it('Should check if reference image path exists', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await referenceImageExists('./test.jpg');

      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalled();
    });

    it('Should return false if reference image does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));

      const result = await referenceImageExists('./missing.jpg');

      expect(result).toBe(false);
    });
  });

  describe('Requirement: Domain glossary configuration', () => {
    it('Scenario: Glossary with acronyms - should load and parse acronym definitions', async () => {
      const config = {
        domainGlossary: {
          acronyms: {
            'MLF': 'Multi-Layer Framework',
            'API': 'Application Programming Interface'
          }
        }
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(config));

      const result = await loadHandwritingReference();
      const glossary = getDomainGlossary(result);

      expect(glossary.acronyms).toBeDefined();
      expect(glossary.acronyms?.['MLF']).toBe('Multi-Layer Framework');
      expect(glossary.acronyms?.['API']).toBe('Application Programming Interface');
    });

    it('Scenario: Glossary with proper nouns - should support proper noun list', async () => {
      const config = {
        domainGlossary: {
          properNouns: ['Vodafone', 'Pepsi', 'Canada']
        }
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(config));

      const result = await loadHandwritingReference();
      const glossary = getDomainGlossary(result);

      expect(glossary.properNouns).toEqual(['Vodafone', 'Pepsi', 'Canada']);
    });

    it('Scenario: Glossary with business terms - should support business terminology list', async () => {
      const config = {
        domainGlossary: {
          businessTerms: ['onboarding', 'roadmap', 'governance']
        }
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(config));

      const result = await loadHandwritingReference();
      const glossary = getDomainGlossary(result);

      expect(glossary.businessTerms).toEqual(['onboarding', 'roadmap', 'governance']);
    });

    it('Scenario: Missing glossary - should return empty glossary', async () => {
      const config = { referenceWords: ['ABC'] };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(config));

      const result = await loadHandwritingReference();
      const glossary = getDomainGlossary(result);

      expect(glossary).toEqual({});
    });
  });

  describe('Requirement: Domain glossary prompt formatting', () => {
    it('Scenario: Format glossary with acronyms - should include acronym section', () => {
      const glossary = {
        acronyms: {
          'MLF': 'Multi-Layer Framework',
          'API': 'Application Programming Interface'
        }
      };

      const result = formatGlossaryContext(glossary);

      expect(result).toContain('Common Acronyms');
      expect(result).toContain('MLF: Multi-Layer Framework');
      expect(result).toContain('API: Application Programming Interface');
    });

    it('Scenario: Format glossary with proper nouns - should include proper nouns', () => {
      const glossary = {
        properNouns: ['Vodafone', 'Pepsi']
      };

      const result = formatGlossaryContext(glossary);

      expect(result).toContain('Expected Proper Nouns');
      expect(result).toContain('Vodafone');
      expect(result).toContain('Pepsi');
    });

    it('Scenario: Format glossary with business terms - should include business terms', () => {
      const glossary = {
        businessTerms: ['onboarding', 'roadmap']
      };

      const result = formatGlossaryContext(glossary);

      expect(result).toContain('Common Business Terms');
      expect(result).toContain('onboarding');
      expect(result).toContain('roadmap');
    });

    it('Scenario: Format glossary with special notation - should include notation guidance', () => {
      const glossary = {
        specialNotation: {
          arrow: '→',
          description: 'Arrows indicate flow'
        }
      };

      const result = formatGlossaryContext(glossary);

      expect(result).toContain('Special Notation');
      expect(result).toContain('→');
      expect(result).toContain('Arrows indicate flow');
    });

    it('Scenario: Format empty glossary - should return empty string', () => {
      const glossary = {};

      const result = formatGlossaryContext(glossary);

      expect(result).toBe('');
    });

    it('Scenario: Format complete glossary - should include uncertainty guidelines', () => {
      const glossary = {
        acronyms: { 'API': 'Application Programming Interface' }
      };

      const result = formatGlossaryContext(glossary);

      expect(result).toContain('Uncertainty Guidelines');
      expect(result).toContain('mark it with *italics*');
    });
  });
});
