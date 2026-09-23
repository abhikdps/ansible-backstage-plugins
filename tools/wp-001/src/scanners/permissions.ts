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

const PERMISSION_TYPES = new Set(['BasicPermission', 'ResourcePermission']);

/**
 * Scans a TypeScript source file for permission object literals typed as
 * BasicPermission or ResourcePermission. These use object literal syntax
 * with a `name` property rather than createPermission() calls.
 *
 * Pattern:
 *   export const fooPermission: BasicPermission = { name: 'ansible.foo.view', ... };
 */
export function scanPermissions(
  sourceText: string,
  source: ContractInventoryRow['source'],
): ContractInventoryRow[] {
  const rows: ContractInventoryRow[] = [];
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile('__temp.ts', sourceText);

  for (const varDecl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const typeNode = varDecl.getTypeNode();
    if (!typeNode) continue;

    const typeName = typeNode.getText().trim();
    if (!PERMISSION_TYPES.has(typeName)) continue;

    const init = varDecl.getInitializer();
    if (!init || init.getKind() !== SyntaxKind.ObjectLiteralExpression) continue;

    const obj = init.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    const nameProp = obj.getProperty('name');
    if (!nameProp) continue;

    const pa = nameProp.asKind(SyntaxKind.PropertyAssignment);
    if (!pa) continue;
    const nameInit = pa.getInitializer();
    if (!nameInit || nameInit.getKind() !== SyntaxKind.StringLiteral) continue;

    const currentId = (nameInit as import('ts-morph').StringLiteral).getLiteralValue();
    const symbolName = varDecl.getName();

    rows.push({
      family: 'permission',
      currentId,
      runtime: 'portable',
      source: { ...source, symbol: symbolName },
      fixture: fixtureRef('permission', currentId),
    });
  }

  return rows;
}
