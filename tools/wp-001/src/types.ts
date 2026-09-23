export type ContractFamily =
  | 'rest'
  | 'entity'
  | 'permission'
  | 'action'
  | 'frontend'
  | 'export';

export type ContractRuntime =
  | 'portable'
  | 'frontend'
  | 'node'
  | 'backend-plugin'
  | 'backend-module';

export interface ContractSource {
  repository: string;
  revision: string;
  file: string;
  symbol?: string;
}

/** Frozen schema from WP-001 spec. Do not alter without updating the spec. */
export interface ContractInventoryRow {
  family: ContractFamily;
  currentId: string;
  runtime: ContractRuntime;
  source: ContractSource;
  target?: { package: string; symbol: string };
  compatibilityAlias?: string;
  fixture: string;
  owner?: string;
  removalRelease?: string;
}

export interface RepoTarget {
  name: string;
  repoPath: string;
  revision: string;
  outputFile: string;
}
