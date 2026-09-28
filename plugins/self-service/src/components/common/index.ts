// ─── Re-exports from @ansible/backstage-rhaap-react ──────────────────────────
// UI components — single source of truth going forward.
export {
  EmptyState,
  EntityLinkButton,
  PageHeaderSection,
  ScmIntegrationAuthError,
  SkeletonLoader,
  SyncDialog,
  SyncProgressPopover,
} from '@ansible/backstage-rhaap-react';
export type {
  EmptyStateProps,
  PageHeaderSectionProps,
  SyncDialogProps,
} from '@ansible/backstage-rhaap-react';

// Icons
export { GitLabIcon, RedHatIcon } from '@ansible/backstage-rhaap-react';

// Styles
export {
  usePageHeaderStyles,
  useSharedStyles,
  useShellPageStyles,
} from '@ansible/backstage-rhaap-react';

// Sync types
export type {
  SyncStatus,
  SyncStatusMap,
  SyncFilter,
  StartedSyncInfo,
  SyncOutcome,
  SyncProgressEntry,
} from '@ansible/backstage-rhaap-react';

// Sync constants
export {
  SYNC_STARTED_CATEGORY,
  SYNC_COMPLETED_CATEGORY,
  SYNC_FAILED_CATEGORY,
  SYNC_FINISHED_CATEGORY,
  FAST_POLL_INTERVAL_MS,
  SLOW_POLL_INTERVAL_MS,
  TRACKING_TIMEOUT_MS,
} from '@ansible/backstage-rhaap-react';

// Cache utilities
export * from './cache';

// ─── Self-service–specific (not in backstage-rhaap-react) ─────────────────────
export {
  fetchReadmeFromBackend,
  fetchGitFileContentFromBackend,
} from './fetchReadme';
export type { FetchReadmeParams, FetchGitFileOutcome } from './fetchReadme';
export { SCM_INTEGRATION_AUTH_FAILED_CODE } from '@ansible/backstage-rhaap-common/constants';
export { CONFIGURATION_DOCS_URL } from './constants';
export type { SourcesTree } from './types';
