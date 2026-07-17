import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { getMonitoredFolders, getPrimaryMonitoredFolder } from '../src/config';

describe('monitored folder configuration', () => {
  afterEach(() => {
    delete process.env.MONITORED_FOLDERS;
  });

  it('uses a safe local default when MONITORED_FOLDERS is not set', () => {
    delete process.env.MONITORED_FOLDERS;

    expect(getMonitoredFolders()).toEqual([path.resolve('./notes')]);
  });

  it('reads one or more semicolon-separated monitored folders from env', () => {
    process.env.MONITORED_FOLDERS = './notes; ./more-notes ;';

    expect(getMonitoredFolders()).toEqual([
      path.resolve('./notes'),
      path.resolve('./more-notes'),
    ]);
  });

  it('falls back to the local default when MONITORED_FOLDERS is empty', () => {
    process.env.MONITORED_FOLDERS = ' ; ';

    expect(getMonitoredFolders()).toEqual([path.resolve('./notes')]);
  });

  it('uses the first monitored folder as the aggregation default', () => {
    process.env.MONITORED_FOLDERS = './primary;./secondary';

    expect(getPrimaryMonitoredFolder()).toBe(path.resolve('./primary'));
  });
});
