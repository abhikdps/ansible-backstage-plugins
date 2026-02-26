export function formatNameSpace(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s/g, '-');
}

export interface SyncStatus {
  sync_started: number;
  already_syncing: number;
  failed: number;
  invalid: number;
}
