import {
  formatNameSpace,
  buildFileUrl,
  getDirectoryFromPath,
  validateSyncFilter,
  parseSourceId,
  providerMatchesFilter,
  findMatchingProviders,
  ParsedSourceInfo,
} from './helpers';
import type { AnsibleGitContentsProvider } from './providers/AnsibleGitContentsProvider';

describe('helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('formatNameSpace', () => {
    it('should format name space with special characters', () => {
      const result = formatNameSpace('test default ++test 123');
      expect(result).toEqual('test-default-test-123');
    });

    it('should convert to lowercase', () => {
      expect(formatNameSpace('Test Namespace')).toEqual('test-namespace');
    });

    it('should remove special characters', () => {
      expect(formatNameSpace('test@namespace#special!')).toEqual(
        'testnamespacespecial',
      );
    });

    it('should replace spaces with hyphens', () => {
      expect(formatNameSpace('test namespace')).toEqual('test-namespace');
    });

    it('should handle empty string', () => {
      expect(formatNameSpace('')).toEqual('');
    });

    it('should handle multiple spaces', () => {
      expect(formatNameSpace('test   multiple   spaces')).toEqual(
        'test---multiple---spaces',
      );
    });
  });

  describe('buildFileUrl', () => {
    it('should build correct GitHub URL', () => {
      const url = buildFileUrl(
        'github',
        'github.com',
        'org/repo',
        'main',
        'path/to/file.yml',
      );
      expect(url).toBe(
        'https://github.com/org/repo/blob/main/path/to/file.yml',
      );
    });

    it('should build correct GitLab URL', () => {
      const url = buildFileUrl(
        'gitlab',
        'gitlab.com',
        'group/project',
        'main',
        'path/to/file.yml',
      );
      expect(url).toBe(
        'https://gitlab.com/group/project/-/blob/main/path/to/file.yml',
      );
    });

    it('should handle custom hosts', () => {
      const url = buildFileUrl(
        'github',
        'github.enterprise.com',
        'org/repo',
        'develop',
        'galaxy.yml',
      );
      expect(url).toBe(
        'https://github.enterprise.com/org/repo/blob/develop/galaxy.yml',
      );
    });

    it('should handle tags as refs', () => {
      const url = buildFileUrl(
        'github',
        'github.com',
        'org/repo',
        'v1.0.0',
        'galaxy.yml',
      );
      expect(url).toBe('https://github.com/org/repo/blob/v1.0.0/galaxy.yml');
    });
  });

  describe('getDirectoryFromPath', () => {
    it('should return directory from path', () => {
      expect(getDirectoryFromPath('path/to/file.yml')).toBe('path/to');
    });

    it('should return empty string for file at root', () => {
      expect(getDirectoryFromPath('file.yml')).toBe('');
    });

    it('should handle nested paths', () => {
      expect(getDirectoryFromPath('a/b/c/d/file.yml')).toBe('a/b/c/d');
    });

    it('should handle path with single directory', () => {
      expect(getDirectoryFromPath('dir/file.yml')).toBe('dir');
    });
  });

  describe('validateSyncFilter', () => {
    it('should return null for empty filter', () => {
      expect(validateSyncFilter({})).toBeNull();
    });

    it('should return null for valid scmProvider only', () => {
      expect(validateSyncFilter({ scmProvider: 'github' })).toBeNull();
    });

    it('should return null for valid scmProvider and hostName', () => {
      expect(
        validateSyncFilter({ scmProvider: 'github', hostName: 'github.com' }),
      ).toBeNull();
    });

    it('should return null for valid full filter', () => {
      expect(
        validateSyncFilter({
          scmProvider: 'github',
          hostName: 'github.com',
          organization: 'test-org',
        }),
      ).toBeNull();
    });

    it('should return error when hostName without scmProvider', () => {
      expect(validateSyncFilter({ hostName: 'github.com' })).toBe(
        'hostName requires scmProvider to be specified',
      );
    });

    it('should return error when organization without scmProvider', () => {
      expect(validateSyncFilter({ organization: 'test-org' })).toBe(
        'organization requires scmProvider to be specified',
      );
    });

    it('should return error when organization without hostName', () => {
      expect(
        validateSyncFilter({ scmProvider: 'github', organization: 'test-org' }),
      ).toBe('organization requires hostName to be specified');
    });
  });

  describe('parseSourceId', () => {
    it('should parse valid sourceId with 4 parts', () => {
      const result = parseSourceId('dev:github:github.com:test-org');
      expect(result).toEqual({
        env: 'dev',
        scmProvider: 'github',
        hostName: 'github.com',
        organization: 'test-org',
      });
    });

    it('should handle sourceId with fewer than 4 parts', () => {
      const result = parseSourceId('dev:github');
      expect(result).toEqual({
        env: 'dev',
        scmProvider: 'github',
        hostName: 'unknown',
        organization: 'unknown',
      });
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid sourceId format'),
      );
    });

    it('should handle sourceId with more than 4 parts (colons in org)', () => {
      const result = parseSourceId('dev:github:github.com:org:with:colons');
      expect(result).toEqual({
        env: 'dev',
        scmProvider: 'github',
        hostName: 'github.com',
        organization: 'org:with:colons',
      });
      expect(console.warn).toHaveBeenCalled();
    });

    it('should handle empty sourceId', () => {
      const result = parseSourceId('');
      expect(result.env).toBe('unknown');
      expect(console.warn).toHaveBeenCalled();
    });

    it('should handle single part sourceId', () => {
      const result = parseSourceId('dev');
      expect(result).toEqual({
        env: 'dev',
        scmProvider: 'unknown',
        hostName: 'unknown',
        organization: 'unknown',
      });
    });
  });

  describe('providerMatchesFilter', () => {
    const providerInfo: ParsedSourceInfo = {
      env: 'dev',
      scmProvider: 'github',
      hostName: 'github.com',
      organization: 'test-org',
    };

    it('should match when no filter specified', () => {
      expect(providerMatchesFilter(providerInfo, {})).toBe(true);
    });

    it('should match when scmProvider matches', () => {
      expect(
        providerMatchesFilter(providerInfo, { scmProvider: 'github' }),
      ).toBe(true);
    });

    it('should not match when scmProvider differs', () => {
      expect(
        providerMatchesFilter(providerInfo, { scmProvider: 'gitlab' }),
      ).toBe(false);
    });

    it('should match when hostName matches', () => {
      expect(
        providerMatchesFilter(providerInfo, {
          scmProvider: 'github',
          hostName: 'github.com',
        }),
      ).toBe(true);
    });

    it('should not match when hostName differs', () => {
      expect(
        providerMatchesFilter(providerInfo, {
          scmProvider: 'github',
          hostName: 'github.enterprise.com',
        }),
      ).toBe(false);
    });

    it('should match when organization matches', () => {
      expect(
        providerMatchesFilter(providerInfo, {
          scmProvider: 'github',
          hostName: 'github.com',
          organization: 'test-org',
        }),
      ).toBe(true);
    });

    it('should not match when organization differs', () => {
      expect(
        providerMatchesFilter(providerInfo, {
          scmProvider: 'github',
          hostName: 'github.com',
          organization: 'other-org',
        }),
      ).toBe(false);
    });
  });

  describe('findMatchingProviders', () => {
    const createMockProvider = (
      sourceId: string,
    ): AnsibleGitContentsProvider => {
      return {
        getSourceId: () => sourceId,
      } as unknown as AnsibleGitContentsProvider;
    };

    it('should find providers matching single filter', () => {
      const providers = [
        createMockProvider('dev:github:github.com:org1'),
        createMockProvider('dev:gitlab:gitlab.com:org2'),
      ];

      const result = findMatchingProviders(providers, [
        { scmProvider: 'github' },
      ]);

      expect(result.size).toBe(1);
      expect(result.has('dev:github:github.com:org1')).toBe(true);
    });

    it('should find providers matching multiple filters', () => {
      const providers = [
        createMockProvider('dev:github:github.com:org1'),
        createMockProvider('dev:gitlab:gitlab.com:org2'),
        createMockProvider('dev:github:github.enterprise.com:org3'),
      ];

      const result = findMatchingProviders(providers, [
        { scmProvider: 'github', hostName: 'github.com' },
        { scmProvider: 'gitlab' },
      ]);

      expect(result.size).toBe(2);
      expect(result.has('dev:github:github.com:org1')).toBe(true);
      expect(result.has('dev:gitlab:gitlab.com:org2')).toBe(true);
    });

    it('should return empty set when no providers match', () => {
      const providers = [createMockProvider('dev:github:github.com:org1')];

      const result = findMatchingProviders(providers, [
        { scmProvider: 'bitbucket' as any },
      ]);

      expect(result.size).toBe(0);
    });

    it('should handle empty providers list', () => {
      const result = findMatchingProviders([], [{ scmProvider: 'github' }]);
      expect(result.size).toBe(0);
    });

    it('should handle empty filters list', () => {
      const providers = [createMockProvider('dev:github:github.com:org1')];

      const result = findMatchingProviders(providers, []);
      expect(result.size).toBe(0);
    });

    it('should deduplicate when multiple filters match same provider', () => {
      const providers = [createMockProvider('dev:github:github.com:org1')];

      const result = findMatchingProviders(providers, [
        { scmProvider: 'github' },
        { scmProvider: 'github', hostName: 'github.com' },
      ]);

      expect(result.size).toBe(1);
    });
  });
});
