// Types
export type {
  ContributionComponent,
  ActionContext,
  TabContribution,
  CardContribution,
  ActionContribution,
} from './types';

// Extension point IDs
export { EXTENSION_POINTS } from './extensionPoints';
export type { ExtensionPointId } from './extensionPoints';

// Registry singleton + type
export { contributionRegistry } from './registry';
export type { ContributionRegistry } from './registry';

// React hooks (tree-shaken if unused)
export {
  useExtensionTabs,
  useExtensionCards,
  useExtensionActions,
} from './hooks';

// Convenience registration helpers
export * from './helpers';
