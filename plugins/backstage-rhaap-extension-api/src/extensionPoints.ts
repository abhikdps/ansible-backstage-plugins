/** All stable extension point IDs for the self-service plugin.
 *  IDs are guaranteed stable across minor versions per §12 of the architecture doc. */
export const EXTENSION_POINTS = {
  // Git Repository detail page
  GIT_REPO_DETAIL_TABS: 'rhaap.git-repository.detail.tabs',
  GIT_REPO_DETAIL_CARDS: 'rhaap.git-repository.detail.cards',
  GIT_REPO_DETAIL_ACTIONS: 'rhaap.git-repository.detail.actions',
  GIT_REPO_LIST_TABS: 'rhaap.git-repository.list.tabs',

  // Execution Environments detail page
  EE_DETAIL_TABS: 'rhaap.execution-environment.detail.tabs',
  EE_DETAIL_CARDS: 'rhaap.execution-environment.detail.cards',
  EE_DETAIL_ACTIONS: 'rhaap.execution-environment.detail.actions',
  EE_LIST_TABS: 'rhaap.execution-environment.list.tabs',

  // Collections detail page
  COLLECTION_DETAIL_TABS: 'rhaap.collection.detail.tabs',
  COLLECTION_DETAIL_CARDS: 'rhaap.collection.detail.cards',
  COLLECTION_DETAIL_ACTIONS: 'rhaap.collection.detail.actions',

  // Templates detail page
  TEMPLATE_DETAIL_CARDS: 'rhaap.template.detail.cards',
} as const;

export type ExtensionPointId =
  (typeof EXTENSION_POINTS)[keyof typeof EXTENSION_POINTS];
