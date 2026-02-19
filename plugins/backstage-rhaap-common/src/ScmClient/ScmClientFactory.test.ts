import { ConfigReader } from '@backstage/config';
import { ScmClientFactory } from './ScmClientFactory';
import { GithubClient } from './GithubClient';
import { GitlabClient } from './GitlabClient';

jest.mock('./GithubClient');
jest.mock('./GitlabClient');

describe('ScmClientFactory', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createClient', () => {
    it('should create a GithubClient for github provider', async () => {
      const config = new ConfigReader({
        integrations: {
          github: [
            {
              host: 'github.com',
              token: 'test-github-token',
            },
          ],
        },
      });

      const factory = new ScmClientFactory({
        rootConfig: config,
        logger: mockLogger as any,
      });

      const client = await factory.createClient({
        scmProvider: 'github',
        organization: 'ansible',
      });

      expect(GithubClient).toHaveBeenCalledWith({
        config: {
          scmProvider: 'github',
          host: 'github.com',
          organization: 'ansible',
          token: 'test-github-token',
        },
        logger: mockLogger,
      });
      expect(client).toBeInstanceOf(GithubClient);
    });

    it('should create a GitlabClient for gitlab provider', async () => {
      const config = new ConfigReader({
        integrations: {
          gitlab: [
            {
              host: 'gitlab.com',
              token: 'test-gitlab-token',
            },
          ],
        },
      });

      const factory = new ScmClientFactory({
        rootConfig: config,
        logger: mockLogger as any,
      });

      const client = await factory.createClient({
        scmProvider: 'gitlab',
        organization: 'mygroup',
      });

      expect(GitlabClient).toHaveBeenCalledWith({
        config: {
          scmProvider: 'gitlab',
          host: 'gitlab.com',
          organization: 'mygroup',
          token: 'test-gitlab-token',
        },
        logger: mockLogger,
      });
      expect(client).toBeInstanceOf(GitlabClient);
    });

    it('should use default host when not provided', async () => {
      const config = new ConfigReader({
        integrations: {
          github: [
            {
              host: 'github.com',
              token: 'test-token',
            },
          ],
        },
      });

      const factory = new ScmClientFactory({
        rootConfig: config,
        logger: mockLogger as any,
      });

      await factory.createClient({
        scmProvider: 'github',
        organization: 'ansible',
      });

      expect(GithubClient).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            host: 'github.com',
          }),
        }),
      );
    });

    it('should use custom host when provided', async () => {
      const config = new ConfigReader({
        integrations: {
          github: [
            {
              host: 'github.example.com',
              token: 'test-token',
            },
          ],
        },
      });

      const factory = new ScmClientFactory({
        rootConfig: config,
        logger: mockLogger as any,
      });

      await factory.createClient({
        scmProvider: 'github',
        host: 'github.example.com',
        organization: 'ansible',
      });

      expect(GithubClient).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            host: 'github.example.com',
          }),
        }),
      );
    });

    it('should throw error for unsupported SCM provider', async () => {
      const config = new ConfigReader({});
      const factory = new ScmClientFactory({
        rootConfig: config,
        logger: mockLogger as any,
      });

      await expect(
        factory.createClient({
          scmProvider: 'bitbucket' as any,
          organization: 'test',
        }),
      ).rejects.toThrow('Unsupported SCM provider: bitbucket');
    });

    it('should throw error when no GitHub integration is configured for custom host', async () => {
      const config = new ConfigReader({
        integrations: {
          github: [
            {
              host: 'github.com',
              token: 'test-token',
            },
          ],
        },
      });

      const factory = new ScmClientFactory({
        rootConfig: config,
        logger: mockLogger as any,
      });

      await expect(
        factory.createClient({
          scmProvider: 'github',
          host: 'github.example.com',
          organization: 'ansible',
        }),
      ).rejects.toThrow('No GitHub integration configured for host: github.example.com');
    });

    it('should throw error when no GitLab integration is configured for custom host', async () => {
      const config = new ConfigReader({
        integrations: {
          gitlab: [
            {
              host: 'gitlab.com',
              token: 'test-token',
            },
          ],
        },
      });

      const factory = new ScmClientFactory({
        rootConfig: config,
        logger: mockLogger as any,
      });

      await expect(
        factory.createClient({
          scmProvider: 'gitlab',
          host: 'gitlab.example.com',
          organization: 'mygroup',
        }),
      ).rejects.toThrow('No GitLab integration configured for host: gitlab.example.com');
    });

    it('should throw error when GitHub token is missing', async () => {
      const config = new ConfigReader({
        integrations: {
          github: [
            {
              host: 'github.com',
            },
          ],
        },
      });

      const factory = new ScmClientFactory({
        rootConfig: config,
        logger: mockLogger as any,
      });

      await expect(
        factory.createClient({
          scmProvider: 'github',
          organization: 'ansible',
        }),
      ).rejects.toThrow('No token configured for GitHub host: github.com');
    });

    it('should throw error when GitLab token is missing', async () => {
      const config = new ConfigReader({
        integrations: {
          gitlab: [
            {
              host: 'gitlab.com',
            },
          ],
        },
      });

      const factory = new ScmClientFactory({
        rootConfig: config,
        logger: mockLogger as any,
      });

      await expect(
        factory.createClient({
          scmProvider: 'gitlab',
          organization: 'mygroup',
        }),
      ).rejects.toThrow('No token configured for GitLab host: gitlab.com');
    });

    it('should use gitlab.com as default host for gitlab provider', async () => {
      const config = new ConfigReader({
        integrations: {
          gitlab: [
            {
              host: 'gitlab.com',
              token: 'test-token',
            },
          ],
        },
      });

      const factory = new ScmClientFactory({
        rootConfig: config,
        logger: mockLogger as any,
      });

      await factory.createClient({
        scmProvider: 'gitlab',
        organization: 'mygroup',
      });

      expect(GitlabClient).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            host: 'gitlab.com',
          }),
        }),
      );
    });
  });
});
