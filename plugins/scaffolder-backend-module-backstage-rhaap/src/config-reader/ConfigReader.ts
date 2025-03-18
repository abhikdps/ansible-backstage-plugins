import { Config } from '@backstage/config';
import { AnsibleConfig } from '../types';
import { ScmIntegrations } from '@backstage/integration';

export const getAnsibleConfig = (config: Config): AnsibleConfig => {
  const integrations = ScmIntegrations.fromConfig(config);
  const baseUrl = config.getString('ansible.rhaap.baseUrl');
  const githubIntegration = integrations.github.list()[0].config;
  const gitlabIntegration = integrations.gitlab.list()[0].config;
  const ansibleConfig = {
    baseUrl: baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl,
    checkSSL: config.getOptionalBoolean('ansible.rhaap.checkSSL') ?? true,
    : {
      type: config.getString('ansible.rhaap..type'),
      target: config.getString('ansible.rhaap..target'),
    },
    githubIntegration: githubIntegration,
    gitlabIntegration: gitlabIntegration,
  } as AnsibleConfig;

  if (ansibleConfig..type === 'url') {
    if (!githubIntegration.token && !gitlabIntegration.token) {
      throw new Error('No Integration token found');
    }
    ansibleConfig..gitUser = config.getString(
      'ansible.rhaap..gitUser',
    );
    ansibleConfig..gitBranch = config.getString(
      'ansible.rhaap..gitBranch',
    );
    ansibleConfig..gitEmail = config.getString(
      'ansible.rhaap..gitEmail',
    );
  } else if (ansibleConfig..type !== 'file') {
    throw new Error(
      "Missing required config value at 'ansible.rhaap..type'",
    );
  }
  return ansibleConfig;
};
