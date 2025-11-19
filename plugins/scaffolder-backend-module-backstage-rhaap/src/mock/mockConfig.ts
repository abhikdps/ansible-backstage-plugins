import { MOCK_BASE_URL, MOCK_CHECK_SSL, MOCK_TOKEN } from './mockData';
import * as os from 'os';
import * as path from 'path';

export const MOCK_CONFIG = {
  data: {
    integrations: {
      github: [
        {
          host: 'github.com',
          token: 'mockGitHubPAT',
          apiBaseUrl: 'https://api.github.com',
        },
        // Example: Enterprise GitHub configuration
        // {
        //   host: 'github.enterprise.example.com',
        //   token: 'mockEnterpriseGitHubPAT',
        //   apiBaseUrl: 'https://github.enterprise.example.com/api/v3',
        // },
      ],
      gitlab: [
        {
          host: 'gitlab.com',
          token: 'mockGitlabPAT',
          apiBaseUrl: 'https://gitlab.com/api/v4',
        },
        // Example: Self-hosted GitLab configuration
        // {
        //   host: 'gitlab.internal.example.com',
        //   token: 'mockSelfHostedGitlabPAT',
        //   apiBaseUrl: 'https://gitlab.internal.example.com/api/v4',
        // },
      ],
    },
    ansible: {
      rhaap: {
        baseUrl: MOCK_BASE_URL,
        token: MOCK_TOKEN,
        checkSSL: MOCK_CHECK_SSL,
        showCaseLocation: {
          type: 'file',
          target: path.join(os.tmpdir(), 'ansible-test-showcases'),
        },
      },
      devSpaces: {
        baseUrl: 'https://devspaces.test',
      },
      automationHub: {
        baseUrl: 'https://automationhub.test',
      },
      creatorService: {
        baseUrl: 'localhost',
        port: '8000',
      },
    },
  },
};
