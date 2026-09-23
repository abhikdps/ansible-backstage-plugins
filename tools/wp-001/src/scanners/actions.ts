import { createRequire } from 'node:module';
import path from 'node:path';
import type { ContractInventoryRow } from '../types.ts';
import { fixtureRef } from './utils.ts';
import { repoRoot } from '../config.ts';

const require = createRequire(import.meta.url);
const tsMorph: typeof import('ts-morph') = require(
  path.resolve(repoRoot, 'node_modules', 'ts-morph', 'dist', 'ts-morph.js'),
);
const { Project, SyntaxKind } = tsMorph;

/**
 * Scans a TypeScript source file for createTemplateAction({ id: '...' }) calls.
 */
export function scanActions(
  sourceText: string,
  source: ContractInventoryRow['source'],
): ContractInventoryRow[] {
  const rows: ContractInventoryRow[] = [];
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile('__temp.ts', sourceText);

  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression().getText().split('.').pop() ?? '';
    if (callee !== 'createTemplateAction') continue;

    const args = call.getArguments();
    if (args.length === 0) continue;
    const arg = args[0];
    if (arg.getKind() !== SyntaxKind.ObjectLiteralExpression) continue;

    const obj = arg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    const idProp = obj.getProperty('id');
    if (!idProp) continue;
    const pa = idProp.asKind(SyntaxKind.PropertyAssignment);
    if (!pa) continue;
    const init = pa.getInitializer();
    if (!init || init.getKind() !== SyntaxKind.StringLiteral) continue;

    const currentId = (init as import('ts-morph').StringLiteral).getLiteralValue();
    rows.push({
      family: 'action',
      currentId,
      runtime: 'node',
      source,
      fixture: fixtureRef('action', currentId),
    });
  }

  return rows;
}
