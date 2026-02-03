import { readSchedulerServiceTaskScheduleDefinitionFromConfig } from '@backstage/backend-plugin-api';
import type { Config } from '@backstage/config';
import type { AnsibleGitContentsSourceConfig, ScmProvider } from './types';

export function readAnsibleGitContentsConfigs(
  config: Config,
): AnsibleGitContentsSourceConfig[] {
  const providerConfigs = config.getOptionalConfig('catalog.providers.rhaap');

  if (!providerConfigs) {
    console.log(
      '[AnsibleGitContentsConfig] No catalog.providers.rhaap config found',
    );
    return [];
  }

  const allSources: AnsibleGitContentsSourceConfig[] = [];
  const envKeys = providerConfigs.keys();
  console.log(
    `[AnsibleGitContentsConfig] Found environments: ${envKeys.join(', ')}`,
  );

  for (const envKey of envKeys) {
    const envConfig = providerConfigs.getConfig(envKey);

    const hasAnsibleGitContents = envConfig.has('sync.ansibleGitContents');
    console.log(
      `[AnsibleGitContentsConfig] Environment '${envKey}' has ansibleGitContents: ${hasAnsibleGitContents}`,
    );

    if (!hasAnsibleGitContents) {
      continue;
    }

    const gitContentsConfig = envConfig.getConfig('sync.ansibleGitContents');

    const providerEnabled =
      gitContentsConfig.getOptionalBoolean('enabled') ?? true;
    console.log(
      `[AnsibleGitContentsConfig] Environment '${envKey}' ansibleGitContents enabled: ${providerEnabled}`,
    );

    if (!providerEnabled) {
      console.log(
        `[AnsibleGitContentsConfig] ansibleGitContents provider is disabled in '${envKey}', skipping`,
      );
      continue;
    }

    const hasSources = gitContentsConfig.has('sources');
    console.log(
      `[AnsibleGitContentsConfig] Environment '${envKey}' has ansibleGitContents.sources: ${hasSources}`,
    );

    if (!hasSources) {
      continue;
    }

    const sourcesConfig = gitContentsConfig.getConfigArray('sources');
    console.log(
      `[AnsibleGitContentsConfig] Found ${sourcesConfig.length} sources in '${envKey}'`,
    );

    for (const sourceConfig of sourcesConfig) {
      const source = readSourceConfig(sourceConfig);
      if (source) {
        console.log(
          `[AnsibleGitContentsConfig] Parsed source: ${source.scmProvider}/${source.organization}`,
        );
        allSources.push(source);
      }
    }
  }

  return allSources;
}

function readSourceConfig(
  config: Config,
): AnsibleGitContentsSourceConfig | null {
  try {
    const scmProvider = config.getString('scmProvider') as ScmProvider;
    const organization = config.getString('organization');

    if (!['github', 'gitlab'].includes(scmProvider)) {
      throw new Error(
        `Invalid scmProvider: ${scmProvider}. Must be 'github' or 'gitlab'.`,
      );
    }

    const enabled = config.getOptionalBoolean('enabled') ?? true;
    const host = config.getOptionalString('host');
    const branches = config.getOptionalStringArray('branches');
    const tags = config.getOptionalStringArray('tags');
    const galaxyFilePaths = config.getOptionalStringArray('galaxyFilePaths');
    const crawlDepth = config.getOptionalNumber('crawlDepth') ?? 5;

    if (!config.has('schedule')) {
      throw new Error('Schedule is required for Ansible Git Contents source');
    }
    const schedule = readSchedulerServiceTaskScheduleDefinitionFromConfig(
      config.getConfig('schedule'),
    );

    console.log(
      `[AnsibleGitContentsConfig] Source config: scmProvider=${scmProvider}, org=${organization}, branches=${JSON.stringify(branches)}, tags=${JSON.stringify(tags)}, crawlDepth=${crawlDepth}`,
    );

    return {
      enabled,
      scmProvider,
      host,
      organization,
      branches,
      tags,
      galaxyFilePaths,
      crawlDepth,
      schedule,
    };
  } catch (error) {
    console.error(
      `[AnsibleGitContentsConfig] Error reading source config: ${error}`,
    );
    return null;
  }
}
