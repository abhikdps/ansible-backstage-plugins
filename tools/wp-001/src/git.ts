import { execSync } from 'node:child_process';

export function revParse(repoPath: string, revision: string): string {
  return execSync(`git rev-parse ${revision}`, {
    cwd: repoPath,
    encoding: 'utf8',
  }).trim();
}

export function lsTree(
  repoPath: string,
  revision: string,
  subPath?: string,
): string[] {
  const pathArg = subPath ? ` -- ${subPath}` : '';
  const out = execSync(
    `git ls-tree -r --name-only ${revision}${pathArg}`,
    { cwd: repoPath, encoding: 'utf8' },
  ).trim();
  return out ? out.split('\n') : [];
}

export function showFile(
  repoPath: string,
  revision: string,
  filePath: string,
): string {
  return execSync(`git show ${revision}:${filePath}`, {
    cwd: repoPath,
    encoding: 'utf8',
  });
}
