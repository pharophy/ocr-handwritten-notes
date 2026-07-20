import path from 'path';

const DEFAULT_MONITORED_FOLDERS = ['./notes'];

export function getMonitoredFolders(): string[] {
  const configured = process.env.MONITORED_FOLDERS;
  const configuredFolders = configured
    ? configured.split(';').map(folder => folder.trim()).filter(Boolean)
    : [];
  const folders = configuredFolders.length > 0 ? configuredFolders : DEFAULT_MONITORED_FOLDERS;

  return folders.map(folder => path.resolve(folder));
}

export function getPrimaryMonitoredFolder(): string {
  return getMonitoredFolders()[0];
}
