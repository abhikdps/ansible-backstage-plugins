import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { repos } from './config.ts';
import { revParse, lsTree, showFile } from './git.ts';
import { scanSourceFile, scanPackageExports } from './scanners/index.ts';
import type { ContractInventoryRow, RepoTarget } from './types.ts';

function log(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

function repoName(repoPath: string): string {
  return path.basename(repoPath);
}

async function scanRepo(target: RepoTarget): Promise<ContractInventoryRow[]> {
  const { name, repoPath, revision, outputFile } = target;
  const sha = revParse(repoPath, revision);
  const repository = repoName(repoPath);

  log(`\n[${name}] repo=${repository} revision=${revision} sha=${sha.slice(0, 12)}`);

  const allFiles = lsTree(repoPath, revision, 'plugins');
  const tsFiles = allFiles.filter(
    f =>
      f.endsWith('.ts') &&
      !f.endsWith('.test.ts') &&
      !f.endsWith('.d.ts') &&
      !f.includes('/node_modules/'),
  );
  const packageJsonFiles = allFiles.filter(f => f.endsWith('/package.json'));

  log(`  ${tsFiles.length} TypeScript source files, ${packageJsonFiles.length} package.json files`);

  const rows: ContractInventoryRow[] = [];

  // Scan package.json exports
  for (const pkgFile of packageJsonFiles) {
    try {
      const content = showFile(repoPath, revision, pkgFile);
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const source: ContractInventoryRow['source'] = {
        repository,
        revision: sha,
        file: pkgFile,
      };
      rows.push(...scanPackageExports(parsed, source));
    } catch {
      // Skip unparseable package.json files
    }
  }

  // Scan TypeScript source files
  let processed = 0;
  for (const tsFile of tsFiles) {
    try {
      const content = showFile(repoPath, revision, tsFile);
      const source: ContractInventoryRow['source'] = {
        repository,
        revision: sha,
        file: tsFile,
      };
      rows.push(...scanSourceFile(content, source));
      processed++;
    } catch {
      // Skip files that can't be read (e.g. binary accidentally tracked)
    }
  }

  log(`  Processed ${processed} files`);

  // Summary by family
  const byFamily = new Map<string, number>();
  for (const row of rows) {
    byFamily.set(row.family, (byFamily.get(row.family) ?? 0) + 1);
  }
  for (const [family, count] of [...byFamily.entries()].sort()) {
    log(`    ${family}: ${count}`);
  }
  log(`  Total: ${rows.length} contract rows`);

  // Write output
  const outPath = path.resolve(repoPath, outputFile);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(rows, null, 2) + '\n', 'utf8');
  log(`  Written → ${outputFile}`);

  return rows;
}

async function main(): Promise<void> {
  log('WP-001 Contract Inventory Scanner');
  log('==================================');

  let totalRows = 0;
  for (const target of repos) {
    const rows = await scanRepo(target);
    totalRows += rows.length;
  }

  log(`\nDone. Total rows across all repos: ${totalRows}`);
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
