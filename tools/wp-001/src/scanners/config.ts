import { createRequire } from 'node:module';
import path from 'node:path';
import type { ContractInventoryRow, ContractRuntime } from '../types.ts';
import { fixtureRef } from './utils.ts';
import { repoRoot } from '../config.ts';

const require = createRequire(import.meta.url);
const tsMorph: typeof import('ts-morph') = require(
  path.resolve(repoRoot, 'node_modules', 'ts-morph', 'dist', 'ts-morph.js'),
);
const { Project, SyntaxKind } = tsMorph;

type TsMorphNode = import('ts-morph').Node;
type TypeNode = import('ts-morph').TypeNode;
type TypeLiteralNode = import('ts-morph').TypeLiteralNode;

/** Joins path segments, treating '[]' as a suffix (no dot before it). */
function joinPath(segments: string[]): string {
  return segments.reduce((acc, seg) => {
    if (seg === '[]') return acc + '[]';
    return acc ? `${acc}.${seg}` : seg;
  }, '');
}

/** Extract @visibility or @deepVisibility runtime from JSDoc on a node. */
function visibilityFromJsDocs(node: TsMorphNode): ContractRuntime | undefined {
  const jsDocs = (node as any).getJsDocs?.() as
    import('ts-morph').JSDoc[] | undefined;
  if (!jsDocs?.length) return undefined;
  for (const jsDoc of jsDocs) {
    for (const tag of jsDoc.getTags()) {
      const tagName = tag.getTagName();
      if (tagName !== 'visibility' && tagName !== 'deepVisibility') continue;
      const comment = tag.getComment();
      const text = (typeof comment === 'string' ? comment : '').trim();
      if (text === 'frontend') return 'frontend';
      if (text === 'backend' || text === 'secret') return 'node';
    }
  }
  return undefined;
}

function isPrimitive(typeNode: TypeNode): boolean {
  const k = typeNode.getKind();
  return (
    k === SyntaxKind.StringKeyword ||
    k === SyntaxKind.BooleanKeyword ||
    k === SyntaxKind.NumberKeyword ||
    k === SyntaxKind.LiteralType ||
    k === SyntaxKind.UndefinedKeyword ||
    k === SyntaxKind.NullKeyword ||
    k === SyntaxKind.AnyKeyword ||
    k === SyntaxKind.UnknownKeyword
  );
}

type Resolved =
  | { kind: 'primitive' }
  | { kind: 'external-ref' }
  | { kind: 'object'; inner: TypeLiteralNode }
  | { kind: 'array-primitive' }
  | { kind: 'array-object'; inner: TypeLiteralNode };

function resolveType(typeNode: TypeNode): Resolved {
  const k = typeNode.getKind();

  // Union: strip undefined/null, then resolve remaining
  if (k === SyntaxKind.UnionType) {
    const union = typeNode.asKindOrThrow(SyntaxKind.UnionType);
    const rest = union
      .getTypeNodes()
      .filter(
        t =>
          !isPrimitive(t) ||
          (t.getKind() !== SyntaxKind.UndefinedKeyword &&
            t.getKind() !== SyntaxKind.NullKeyword),
      );
    if (rest.length === 0) return { kind: 'primitive' };
    if (rest.length === 1) return resolveType(rest[0]);
    // Check if all non-null/undefined members are primitive
    if (rest.every(t => isPrimitive(t))) return { kind: 'primitive' };
    // Mixed — pick the first complex one
    const obj = rest.find(t => t.getKind() === SyntaxKind.TypeLiteral);
    if (obj)
      return {
        kind: 'object',
        inner: obj.asKindOrThrow(SyntaxKind.TypeLiteral),
      };
    return { kind: 'primitive' };
  }

  // Object literal
  if (k === SyntaxKind.TypeLiteral) {
    return {
      kind: 'object',
      inner: typeNode.asKindOrThrow(SyntaxKind.TypeLiteral),
    };
  }

  // Array: T[] form
  if (k === SyntaxKind.ArrayType) {
    const elem = typeNode
      .asKindOrThrow(SyntaxKind.ArrayType)
      .getElementTypeNode();
    if (elem.getKind() === SyntaxKind.TypeLiteral) {
      return {
        kind: 'array-object',
        inner: elem.asKindOrThrow(SyntaxKind.TypeLiteral),
      };
    }
    return { kind: 'array-primitive' };
  }

  // TypeReference: Array<T> or external type
  if (k === SyntaxKind.TypeReference) {
    const ref = typeNode.asKindOrThrow(SyntaxKind.TypeReference);
    if (ref.getTypeName().getText() === 'Array') {
      const args = ref.getTypeArguments();
      if (args.length > 0 && args[0].getKind() === SyntaxKind.TypeLiteral) {
        return {
          kind: 'array-object',
          inner: args[0].asKindOrThrow(SyntaxKind.TypeLiteral),
        };
      }
      return { kind: 'array-primitive' };
    }
    return { kind: 'external-ref' };
  }

  if (isPrimitive(typeNode)) return { kind: 'primitive' };
  return { kind: 'primitive' };
}

function makeRow(
  segments: string[],
  symbol: string,
  runtime: ContractRuntime,
  source: ContractInventoryRow['source'],
): ContractInventoryRow {
  const currentId = joinPath(segments);
  return {
    family: 'config',
    currentId,
    runtime,
    source: { ...source, symbol },
    fixture: fixtureRef('config', currentId),
  };
}

function walkTypeLiteral(
  node: TypeLiteralNode,
  segments: string[],
  parentRuntime: ContractRuntime,
  source: ContractInventoryRow['source'],
  rows: ContractInventoryRow[],
  depth: number,
): void {
  if (depth > 10) return;

  for (const member of node.getMembers()) {
    // PropertySignature: propName?: Type
    if (member.getKind() === SyntaxKind.PropertySignature) {
      const prop = member.asKindOrThrow(SyntaxKind.PropertySignature);
      const propName = prop.getName();
      const typeNode = prop.getTypeNode();
      if (!typeNode) continue;

      const runtime = visibilityFromJsDocs(prop) ?? parentRuntime;
      const newSegments = [...segments, propName];
      const resolved = resolveType(typeNode);

      if (resolved.kind === 'primitive' || resolved.kind === 'external-ref') {
        rows.push(makeRow(newSegments, propName, runtime, source));
      } else if (resolved.kind === 'array-primitive') {
        rows.push(makeRow(newSegments, propName, runtime, source));
      } else if (resolved.kind === 'object') {
        walkTypeLiteral(
          resolved.inner,
          newSegments,
          runtime,
          source,
          rows,
          depth + 1,
        );
      } else if (resolved.kind === 'array-object') {
        walkTypeLiteral(
          resolved.inner,
          [...newSegments, '[]'],
          runtime,
          source,
          rows,
          depth + 1,
        );
      }
    }

    // IndexSignature: [key: string]: T
    if (member.getKind() === SyntaxKind.IndexSignature) {
      const idx = member.asKindOrThrow(SyntaxKind.IndexSignature);
      const returnType = idx.getReturnTypeNode();
      if (!returnType) continue;

      const runtime = visibilityFromJsDocs(idx) ?? parentRuntime;
      const indexedSegments = [...segments, '[]'];
      const resolved = resolveType(returnType);

      if (resolved.kind === 'primitive' || resolved.kind === 'external-ref') {
        rows.push(makeRow(indexedSegments, '[]', runtime, source));
      } else if (resolved.kind === 'object') {
        walkTypeLiteral(
          resolved.inner,
          indexedSegments,
          runtime,
          source,
          rows,
          depth + 1,
        );
      } else if (resolved.kind === 'array-object') {
        walkTypeLiteral(
          resolved.inner,
          [...indexedSegments, '[]'],
          runtime,
          source,
          rows,
          depth + 1,
        );
      }
    }
  }
}

/**
 * Parses a config.d.ts file and extracts all leaf config key paths
 * as ContractInventoryRow entries with family 'config'.
 */
export function scanConfigSchema(
  sourceText: string,
  source: ContractInventoryRow['source'],
): ContractInventoryRow[] {
  const rows: ContractInventoryRow[] = [];
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile('__config.d.ts', sourceText);

  // Find: export interface Config { ... }
  const configInterface = sf
    .getInterfaces()
    .find(i => i.getName() === 'Config' && i.isExported());
  if (!configInterface) return rows;

  // Build a synthetic TypeLiteralNode-like structure from the interface members
  // by wrapping them in a fake TypeLiteral for uniform handling.
  // Instead, walk the interface members directly.
  for (const member of configInterface.getMembers()) {
    if (member.getKind() === SyntaxKind.PropertySignature) {
      const prop = member.asKindOrThrow(SyntaxKind.PropertySignature);
      const propName = prop.getName();
      const typeNode = prop.getTypeNode();
      if (!typeNode) continue;

      const runtime = visibilityFromJsDocs(prop) ?? 'portable';
      const resolved = resolveType(typeNode);

      if (resolved.kind === 'primitive' || resolved.kind === 'external-ref') {
        rows.push(makeRow([propName], propName, runtime, source));
      } else if (resolved.kind === 'array-primitive') {
        rows.push(makeRow([propName], propName, runtime, source));
      } else if (resolved.kind === 'object') {
        walkTypeLiteral(resolved.inner, [propName], runtime, source, rows, 1);
      } else if (resolved.kind === 'array-object') {
        walkTypeLiteral(
          resolved.inner,
          [propName, '[]'],
          runtime,
          source,
          rows,
          1,
        );
      }
    }
  }

  return rows;
}
