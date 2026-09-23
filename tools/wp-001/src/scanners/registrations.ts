import { createRequire } from 'node:module';
import path from 'node:path';
import type { ContractInventoryRow } from '../types.ts';
import { fixtureRef } from './utils.ts';
import { repoRoot } from '../config.ts';

const require = createRequire(import.meta.url);
// ts-morph is CJS; import via createRequire so this ESM module can consume it.
const tsMorph: typeof import('ts-morph') = require(
  path.resolve(repoRoot, 'node_modules', 'ts-morph', 'dist', 'ts-morph.js'),
);
const { Project, SyntaxKind } = tsMorph;

function getStringProp(obj: import('ts-morph').ObjectLiteralExpression, propName: string): string | undefined {
  const prop = obj.getProperty(propName);
  if (!prop) return undefined;
  const pa = prop.asKind(SyntaxKind.PropertyAssignment);
  if (!pa) return undefined;
  const init = pa.getInitializer();
  if (!init) return undefined;
  if (init.getKind() === SyntaxKind.StringLiteral) {
    return (init as import('ts-morph').StringLiteral).getLiteralValue();
  }
  return undefined;
}

/**
 * Scans a TypeScript source file for createBackendPlugin and createBackendModule calls.
 */
export function scanRegistrations(
  sourceText: string,
  source: ContractInventoryRow['source'],
): ContractInventoryRow[] {
  const rows: ContractInventoryRow[] = [];
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile('__temp.ts', sourceText);

  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression().getText().split('.').pop() ?? '';

    if (callee !== 'createBackendModule' && callee !== 'createBackendPlugin') {
      continue;
    }

    const args = call.getArguments();
    if (args.length === 0) continue;
    const arg = args[0];
    if (arg.getKind() !== SyntaxKind.ObjectLiteralExpression) continue;

    const obj = arg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    const pluginId = getStringProp(obj, 'pluginId');
    const moduleId = getStringProp(obj, 'moduleId');

    if (!pluginId) continue;

    if (callee === 'createBackendModule') {
      if (!moduleId) continue;
      const currentId = `${pluginId}/${moduleId}`;
      rows.push({
        family: 'export',
        currentId,
        runtime: 'backend-module',
        source,
        fixture: fixtureRef('export', currentId),
      });
    } else {
      const currentId = pluginId;
      rows.push({
        family: 'export',
        currentId,
        runtime: 'backend-plugin',
        source,
        fixture: fixtureRef('export', currentId),
      });
    }
  }

  return rows;
}
