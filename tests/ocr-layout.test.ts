import { describe, expect, it } from 'vitest';
import { normalizeLayout } from '../src/ocr';

// fix-ocr-fidelity 2.11–2.14: line breaks and indentation follow the page.

describe('2.11 nested bullets stay on their own lines', () => {
  it('keeps a three-level structure line for line', () => {
    const input = [
      '- placeholder parent',
      '  - placeholder child A',
      '    - placeholder grandchild',
      '  - placeholder child B',
    ].join('\n');
    expect(normalizeLayout(input)).toBe(input);
  });
});

describe('2.12 wrapped bullets vs labels', () => {
  it('joins a hanging-indented continuation onto its bullet with one space', () => {
    expect(normalizeLayout('- first part of a long\n  bullet that wraps\n- next bullet')).toBe(
      '- first part of a long bullet that wraps\n- next bullet'
    );
  });

  it('keeps an unindented label after a bullet on its own line', () => {
    expect(normalizeLayout('- some bullet\n2027\n- move away')).toBe('- some bullet\n2027\n- move away');
    expect(normalizeLayout('- some bullet\nNotes:\n- next')).toBe('- some bullet\nNotes:\n- next');
  });

  it('never merges a deeper bullet into its parent', () => {
    expect(normalizeLayout('- parent line\n    - deeper bullet')).toBe('- parent line\n  - deeper bullet');
  });
});

describe('2.13 consistent indentation unit', () => {
  const expected = '- a item\n  - b item\n    - c item\n  - d item';

  it.each([
    ['2 spaces', '- a item\n  - b item\n    - c item\n  - d item'],
    ['3 spaces', '- a item\n   - b item\n      - c item\n   - d item'],
    ['4 spaces', '- a item\n    - b item\n        - c item\n    - d item'],
    ['tabs', '- a item\n\t- b item\n\t\t- c item\n\t- d item'],
  ])('normalizes %s to two spaces per level', (_label, input) => {
    expect(normalizeLayout(input)).toBe(expected);
  });

  it('caps a jump at one level deeper than the parent', () => {
    expect(normalizeLayout('- a item\n          - b item')).toBe('- a item\n  - b item');
  });
});

describe('2.14 blank lines and tables', () => {
  it('keeps one blank line between blocks and collapses runs', () => {
    expect(normalizeLayout('- a item\n\n\n\n- b item')).toBe('- a item\n\n- b item');
  });

  it('leaves markdown table rows untouched', () => {
    const table = '| x | y |\n|---|---|\n|  1 |  2 |';
    expect(normalizeLayout(`Title\n\n${table}`)).toBe(`Title\n\n${table}`);
  });
});
