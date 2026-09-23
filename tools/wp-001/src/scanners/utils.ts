import type { ContractFamily } from '../types.ts';

/** Forward-reference fixture path for slice-1 rows (no fixture content yet). */
export function fixtureRef(family: ContractFamily, currentId: string): string {
  const safe = currentId.replace(/[/:@#]/g, '_');
  return `tools/wp-001/inventory/fixtures/${family}/${safe}.json`;
}
