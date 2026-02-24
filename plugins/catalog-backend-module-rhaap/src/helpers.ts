import { AnsibleGitContentsProvider } from './providers/AnsibleGitContentsProvider';

export function formatNameSpace(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^\w\s]/gi, '')
    .replaceAll(/\s/g, '-');
}

export function buildFileUrl(
  scmProvider: 'github' | 'gitlab',
  host: string,
  repoPath: string,
  ref: string,
  filePath: string,
): string {
  if (scmProvider === 'github') {
    return `https://${host}/${repoPath}/blob/${ref}/${filePath}`;
  }
  // gitlab
  return `https://${host}/${repoPath}/-/blob/${ref}/${filePath}`;
}

export function getDirectoryFromPath(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  return lastSlash > 0 ? filePath.substring(0, lastSlash) : '';
}

export interface SyncFilter {
  scmProvider?: 'github' | 'gitlab';
  hostName?: string;
  organization?: string;
}

export function validateSyncFilter(filter: SyncFilter): string | null {
  if (!filter.scmProvider && !filter.hostName && !filter.organization) {
    return null;
  }

  if (filter.hostName && !filter.scmProvider) {
    return 'hostName requires scmProvider to be specified';
  }

  if (filter.organization) {
    if (!filter.scmProvider) {
      return 'organization requires scmProvider to be specified';
    }
    if (!filter.hostName) {
      return 'organization requires hostName to be specified';
    }
  }

  return null;
}

export interface ParsedSourceInfo {
  env: string;
  scmProvider: string;
  hostName: string;
  organization: string;
}

export function parseSourceId(sourceId: string): ParsedSourceInfo {
  const parts = sourceId.split(':');

  if (parts.length !== 4) {
    console.warn(
      `[parseSourceId] Invalid sourceId format: ${sourceId}, expected 4 parts separated by ':'`,
    );
    return {
      env: parts[0] || 'unknown',
      scmProvider: parts[1] || 'unknown',
      hostName: parts[2] || 'unknown',
      organization: parts.slice(3).join(':') || 'unknown',
    };
  }

  return {
    env: parts[0],
    scmProvider: parts[1],
    hostName: parts[2],
    organization: parts[3],
  };
}

export function providerMatchesFilter(
  providerInfo: ParsedSourceInfo,
  filter: SyncFilter,
): boolean {
  if (filter.scmProvider && providerInfo.scmProvider !== filter.scmProvider) {
    return false;
  }
  if (filter.hostName && providerInfo.hostName !== filter.hostName) {
    return false;
  }
  if (
    filter.organization &&
    providerInfo.organization !== filter.organization
  ) {
    return false;
  }
  return true;
}

export function findMatchingProviders(
  providers: AnsibleGitContentsProvider[],
  filters: SyncFilter[],
): Set<string> {
  const matchedProviderIds = new Set<string>();

  for (const filter of filters) {
    for (const provider of providers) {
      const sourceId = provider.getSourceId();
      const providerInfo = parseSourceId(sourceId);

      if (providerMatchesFilter(providerInfo, filter)) {
        matchedProviderIds.add(sourceId);
      }
    }
  }

  return matchedProviderIds;
}

export interface SyncStatus {
  sync_started: number;
  already_syncing: number;
  failed: number;
  invalid: number;
}

export interface SCMProviderStatus {
  sourceId: string;
  scmProvider: string;
  hostName: string;
  organization: string;
  providerName: string;
  enabled: boolean;
  syncInProgress: boolean;
  lastSyncTime: string | null;
  lastFailedSyncTime: string | null;
  lastSyncStatus: 'success' | 'failure' | null;
  collectionsFound: number;
  collectionsDelta: number;
}

export type ProviderStatus = SCMProviderStatus;

export type SyncResultStatus =
  | 'sync_started'
  | 'already_syncing'
  | 'failed'
  | 'invalid';

export interface SCMSyncResult {
  scmProvider: string;
  hostName: string;
  organization: string;
  providerName?: string;
  status: SyncResultStatus;
  error?: { code: string; message: string };
}
