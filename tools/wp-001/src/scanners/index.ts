import type { ContractInventoryRow } from '../types.ts';
import { scanRegistrations } from './registrations.ts';
import { scanActions } from './actions.ts';
import { scanPermissions } from './permissions.ts';
import { scanFrontend } from './frontend.ts';
import { scanPackageExports } from './exports.ts';

export { scanPackageExports };

/**
 * Runs all AST-based scanners on a single TypeScript source file.
 * Returns all contract rows found in that file.
 */
export function scanSourceFile(
  sourceText: string,
  source: ContractInventoryRow['source'],
): ContractInventoryRow[] {
  return [
    ...scanRegistrations(sourceText, source),
    ...scanActions(sourceText, source),
    ...scanPermissions(sourceText, source),
    ...scanFrontend(sourceText, source),
  ];
}
