import type { LoggerService } from '@backstage/backend-plugin-api';
import {
  ScmClient,
  RepositoryInfo,
  DirectoryEntry,
} from '@ansible/backstage-rhaap-common';
import type {
  DiscoveredGalaxyFile,
  AnsibleGitContentsSourceConfig,
} from '../../types';
import { validateGalaxyContent } from '../galaxySchema';
import yaml from 'yaml';

export type {
  RepositoryInfo,
  DirectoryEntry,
} from '@ansible/backstage-rhaap-common';

export interface DiscoveryOptions {
  branches?: string[];
  tags?: string[];
  galaxyFilePaths?: string[];
  crawlDepth: number;
}

export interface ScmCrawler {
  getRepositories(): Promise<RepositoryInfo[]>;
  getBranches(repo: RepositoryInfo): Promise<string[]>;
  getTags(repo: RepositoryInfo): Promise<string[]>;
  getContents(
    repo: RepositoryInfo,
    ref: string,
    path: string,
  ): Promise<DirectoryEntry[]>;
  getFileContent(
    repo: RepositoryInfo,
    ref: string,
    path: string,
  ): Promise<string>;
  buildSourceLocation(repo: RepositoryInfo, ref: string, path: string): string;
  discoverGalaxyFiles(
    options: DiscoveryOptions,
  ): Promise<DiscoveredGalaxyFile[]>;
  discoverGalaxyFilesInRepos(
    repos: RepositoryInfo[],
    options: DiscoveryOptions,
  ): Promise<DiscoveredGalaxyFile[]>;
}

export interface ScmCrawlerConfig {
  sourceConfig: AnsibleGitContentsSourceConfig;
  logger: LoggerService;
  scmClient: ScmClient;
}

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.github',
  '.gitlab',
  '__pycache__',
  '.tox',
  '.venv',
  'venv',
  '.cache',
  'dist',
  'build',
  'docs',
  'tests',
  'test',
]);

export abstract class BaseScmCrawler implements ScmCrawler {
  protected readonly config: AnsibleGitContentsSourceConfig;
  protected readonly logger: LoggerService;
  protected readonly client: ScmClient;

  constructor(crawlerConfig: ScmCrawlerConfig) {
    this.config = crawlerConfig.sourceConfig;
    this.logger = crawlerConfig.logger;
    this.client = crawlerConfig.scmClient;
  }

  protected getSourceId(): string {
    return this.client.getSourceId();
  }

  /** Display name for log messages (e.g. "GithubCrawler", "GitlabCrawler"). */
  protected abstract getCrawlerName(): string;

  /** Label for repos in log messages (e.g. "repositories", "projects"). */
  protected getRepoLabel(): string {
    return 'repositories';
  }

  async getRepositories(): Promise<RepositoryInfo[]> {
    return this.client.getRepositories();
  }

  async getBranches(repo: RepositoryInfo): Promise<string[]> {
    return this.client.getBranches(repo);
  }

  async getTags(repo: RepositoryInfo): Promise<string[]> {
    return this.client.getTags(repo);
  }

  async getContents(
    repo: RepositoryInfo,
    ref: string,
    path: string,
  ): Promise<DirectoryEntry[]> {
    return this.client.getContents(repo, ref, path);
  }

  async getFileContent(
    repo: RepositoryInfo,
    ref: string,
    path: string,
  ): Promise<string> {
    return this.client.getFileContent(repo, ref, path);
  }

  buildSourceLocation(repo: RepositoryInfo, ref: string, path: string): string {
    return this.client.buildSourceLocation(repo, ref, path);
  }

  async discoverGalaxyFiles(
    options: DiscoveryOptions,
  ): Promise<DiscoveredGalaxyFile[]> {
    const repos = await this.getRepositories();
    this.logger.info(
      `[${this.getCrawlerName()}] Starting galaxy.yml discovery in ${repos.length} ${this.getRepoLabel()}`,
    );
    return this.discoverGalaxyFilesInRepos(repos, options);
  }

  async discoverGalaxyFilesInRepos(
    repos: RepositoryInfo[],
    options: DiscoveryOptions,
  ): Promise<DiscoveredGalaxyFile[]> {
    const discovered: DiscoveredGalaxyFile[] = [];
    const skippedRepos: Array<{ repo: string; reason: string }> = [];
    const crawlerName = this.getCrawlerName();

    for (const repo of repos) {
      try {
        const refsToSearch = await this.getRefsToSearch(repo, options);
        let repoCollectionCount = 0;

        for (const { ref, refType } of refsToSearch) {
          const galaxyFiles = await this.findGalaxyFilesInRepo(
            repo,
            ref,
            refType,
            options,
          );
          repoCollectionCount += galaxyFiles.length;
          discovered.push(...galaxyFiles);
        }

        if (repoCollectionCount === 0) {
          skippedRepos.push({
            repo: repo.fullPath,
            reason: 'no valid galaxy.yml/yaml files found',
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        skippedRepos.push({
          repo: repo.fullPath,
          reason: `error: ${errorMsg}`,
        });
        this.logger.warn(
          `[${crawlerName}] Error discovering collections in ${repo.fullPath}: ${error}`,
        );
      }
    }

    if (skippedRepos.length > 0) {
      this.logger.info(
        `[${crawlerName}] Skipped ${skippedRepos.length} ${this.getRepoLabel()} with no collections:`,
      );
      for (const { repo, reason } of skippedRepos) {
        this.logger.info(`[${crawlerName}]   - ${repo}: ${reason}`);
      }
    }

    this.logger.info(
      `[${crawlerName}] Discovered ${discovered.length} galaxy.yml files in ${repos.length} ${this.getRepoLabel()}`,
    );
    return discovered;
  }

  protected async getRefsToSearch(
    repo: RepositoryInfo,
    options: DiscoveryOptions,
  ): Promise<Array<{ ref: string; refType: 'branch' | 'tag' }>> {
    const refs: Array<{ ref: string; refType: 'branch' | 'tag' }> = [];
    const searchedBranches = new Set<string>();

    this.logger.debug(
      `[${repo.fullPath}] Default branch: ${repo.defaultBranch}`,
    );
    refs.push({ ref: repo.defaultBranch, refType: 'branch' as const });
    searchedBranches.add(repo.defaultBranch);

    if (options.branches && options.branches.length > 0) {
      const allBranches = await this.getBranches(repo);
      this.logger.debug(
        `[${repo.fullPath}] Available branches: ${allBranches.join(', ') || 'none'}`,
      );
      this.logger.debug(
        `[${repo.fullPath}] Configured additional branches: ${options.branches.join(', ')}`,
      );

      const additionalBranches = allBranches.filter(
        b => options.branches!.includes(b) && !searchedBranches.has(b),
      );

      if (additionalBranches.length > 0) {
        this.logger.debug(
          `[${repo.fullPath}] Will also search branches: ${additionalBranches.join(', ')}`,
        );
        refs.push(
          ...additionalBranches.map(b => ({
            ref: b,
            refType: 'branch' as const,
          })),
        );
        additionalBranches.forEach(b => searchedBranches.add(b));
      }
    }

    this.logger.debug(
      `[${repo.fullPath}] Total branches to search: ${Array.from(searchedBranches).join(', ')}`,
    );

    if (options.tags && options.tags.length > 0) {
      const allTags = await this.getTags(repo);
      const matchingTags = this.filterTags(allTags, options.tags);
      refs.push(
        ...matchingTags.map(t => ({ ref: t, refType: 'tag' as const })),
      );
    }

    return refs;
  }

  protected async findGalaxyFilesInRepo(
    repo: RepositoryInfo,
    ref: string,
    refType: 'branch' | 'tag',
    options: DiscoveryOptions,
  ): Promise<DiscoveredGalaxyFile[]> {
    const discovered: DiscoveredGalaxyFile[] = [];
    const crawlerName = this.getCrawlerName();

    this.logger.debug(
      `[${crawlerName}] Searching ${repo.fullPath} on ${refType} '${ref}' (default branch: ${repo.defaultBranch})`,
    );

    if (options.galaxyFilePaths && options.galaxyFilePaths.length > 0) {
      for (const basePath of options.galaxyFilePaths) {
        const files = await this.crawlDirectory(
          repo,
          ref,
          basePath,
          options.crawlDepth,
        );
        for (const filePath of files) {
          const galaxyFile = await this.processGalaxyFile(
            repo,
            ref,
            refType,
            filePath,
          );
          if (galaxyFile) {
            discovered.push(galaxyFile);
          }
        }
      }
    } else {
      const files = await this.crawlDirectory(
        repo,
        ref,
        '',
        options.crawlDepth,
      );

      if (files.length === 0) {
        this.logger.debug(
          `[${crawlerName}] No galaxy.yml files found in ${repo.fullPath}@${ref} after crawling`,
        );
      }

      for (const filePath of files) {
        const galaxyFile = await this.processGalaxyFile(
          repo,
          ref,
          refType,
          filePath,
        );
        if (galaxyFile) {
          discovered.push(galaxyFile);
        }
      }
    }

    return discovered;
  }

  protected async crawlDirectory(
    repo: RepositoryInfo,
    ref: string,
    path: string,
    depth: number,
  ): Promise<string[]> {
    if (depth <= 0) {
      return [];
    }

    const galaxyFiles: string[] = [];
    const crawlerName = this.getCrawlerName();

    try {
      const contents = await this.getContents(repo, ref, path);

      if (path === '' && contents.length === 0) {
        this.logger.warn(
          `[${crawlerName}] Empty contents returned for ${repo.fullPath}@${ref} root directory`,
        );
      }

      for (const entry of contents) {
        if (entry.type === 'file' && this.isGalaxyFile(entry.name)) {
          this.logger.debug(
            `[${crawlerName}] Found galaxy file: ${repo.fullPath}/${entry.path}@${ref}`,
          );
          galaxyFiles.push(entry.path);
        } else if (entry.type === 'dir') {
          if (this.shouldSkipDirectory(entry.name)) {
            continue;
          }
          const subFiles = await this.crawlDirectory(
            repo,
            ref,
            entry.path,
            depth - 1,
          );
          galaxyFiles.push(...subFiles);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (path === '') {
        this.logger.warn(
          `[${crawlerName}] Failed to fetch contents for ${repo.fullPath}@${ref}: ${errorMsg}`,
        );
      } else {
        this.logger.debug(
          `[${crawlerName}] Error crawling ${repo.fullPath}/${path}@${ref}: ${errorMsg}`,
        );
      }
    }

    return galaxyFiles;
  }

  protected shouldSkipDirectory(name: string): boolean {
    return SKIP_DIRS.has(name.toLowerCase());
  }

  protected async processGalaxyFile(
    repo: RepositoryInfo,
    ref: string,
    refType: 'branch' | 'tag',
    path: string,
  ): Promise<DiscoveredGalaxyFile | null> {
    const crawlerName = this.getCrawlerName();
    try {
      const content = await this.getFileContent(repo, ref, path);

      let parsed: unknown;
      try {
        parsed = yaml.parse(content);
      } catch (parseError) {
        this.logger.warn(
          `[${crawlerName}] Invalid YAML in ${repo.fullPath}/${path}@${ref}: ${parseError}`,
        );
        return null;
      }

      const validation = validateGalaxyContent(parsed);
      if (!validation.success) {
        this.logger.debug(
          `[${crawlerName}] Invalid galaxy.yml in ${repo.fullPath}/${path}@${ref}: ${validation.errors?.join(', ')}`,
        );
        return null;
      }

      return {
        repository: repo,
        ref,
        refType,
        path,
        content,
        metadata: validation.data!,
      };
    } catch (error) {
      this.logger.warn(
        `[${crawlerName}] Error processing ${repo.fullPath}/${path}@${ref}: ${error}`,
      );
      return null;
    }
  }

  protected isGalaxyFile(filename: string): boolean {
    const lowerName = filename.toLowerCase();
    return lowerName === 'galaxy.yml' || lowerName === 'galaxy.yaml';
  }

  protected matchesTagPattern(tag: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      const regexPattern = pattern
        .replaceAll(/[.+^${}()|[\]\\]/g, String.raw`\$&`)
        .replaceAll('*', '.*')
        .replaceAll('?', '.');

      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(tag);
    });
  }

  protected filterTags(allTags: string[], patterns?: string[]): string[] {
    if (!patterns || patterns.length === 0) {
      return [];
    }
    return allTags.filter(tag => this.matchesTagPattern(tag, patterns));
  }
}
