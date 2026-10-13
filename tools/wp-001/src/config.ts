import path from 'node:path';
import type { RepoTarget } from './types.ts';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');

/**
 * Pinned baseline targets for the WP-001 contract inventory.
 *
 * Revisions are pinned SHAs — never branch names. This ensures the scanner is
 * deterministic: the same config always produces the same inventory output.
 *
 * To advance a baseline after a new WP lands:
 *   1. Update the revision SHA below.
 *   2. Run: yarn inventory:scan
 *   3. Review the diff in tools/wp-001/inventory/ — it is the contract changelog.
 *   4. Commit config.ts and the updated inventory files together.
 */
export const repos: RepoTarget[] = [
  {
    name: 'main',
    repoPath: repoRoot,
    // ansible-backstage-plugins main as of 2026-09-23
    revision: '8ee37b7177b8b56a7e8056c896738d1aa0dd23d7',
    outputFile: 'tools/wp-001/inventory/main.json',
  },
  {
    name: 'apme-branch',
    repoPath: repoRoot,
    // feat/apme-eap-next-ui-workflow as of 2026-09-23
    revision: 'a5fd309d78e89f99680012ec21d6094db00b7c1d',
    outputFile: 'tools/wp-001/inventory/apme-branch.json',
  },
  // To add automation-content-plugins:
  // {
  //   name: 'automation-content-plugins',
  //   repoPath: path.resolve(repoRoot, '..', 'automation-content-plugins'),
  //   revision: '<pinned-sha>',
  //   outputFile: 'tools/wp-001/inventory/automation-content-plugins.json',
  // },
];

export { repoRoot };
