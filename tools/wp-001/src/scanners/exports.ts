import type { ContractInventoryRow } from '../types.ts';
import { fixtureRef } from './utils.ts';

/**
 * Scans package.json exports field keys for a plugin.
 * Each key is a stable public entrypoint contract.
 */
export function scanPackageExports(
  packageJson: Record<string, unknown>,
  source: ContractInventoryRow['source'],
): ContractInventoryRow[] {
  const rows: ContractInventoryRow[] = [];
  const packageName = packageJson.name as string | undefined;
  if (!packageName) return rows;

  const exportsField = packageJson.exports;
  if (!exportsField || typeof exportsField !== 'object' || Array.isArray(exportsField)) {
    // No named export map — record the implicit "." entrypoint if main is set
    if (packageJson.main) {
      const currentId = `${packageName}#.`;
      rows.push({
        family: 'export',
        currentId,
        runtime: inferRuntime(packageName),
        source: { ...source, file: source.file, symbol: '.' },
        fixture: fixtureRef('export', currentId),
      });
    }
    return rows;
  }

  for (const key of Object.keys(exportsField as object)) {
    const currentId = `${packageName}#${key}`;
    rows.push({
      family: 'export',
      currentId,
      runtime: inferRuntime(packageName),
      source: { ...source, symbol: key },
      fixture: fixtureRef('export', currentId),
    });
  }
  return rows;
}

function inferRuntime(packageName: string): ContractInventoryRow['runtime'] {
  if (packageName.includes('frontend') || packageName.includes('self-service') || packageName.includes('backstage-rhaap') && !packageName.includes('common') && !packageName.includes('catalog') && !packageName.includes('auth') && !packageName.includes('scaffolder')) {
    return 'frontend';
  }
  if (packageName.includes('backend') || packageName.includes('catalog-backend') || packageName.includes('auth-backend') || packageName.includes('scaffolder-backend')) {
    return 'node';
  }
  return 'portable';
}
