import { Config } from "@backstage/config";

const ANSIBLE_PREFIX = "catalog.providers.ansible";

export type AnsibleDetails = {
  devSpacesBaseUrl: string;
  port?: number;
  baseUrl?: string;
};

export const getHubClusterFromConfig = (config: Config): AnsibleDetails => {
  return {
    devSpacesBaseUrl: config.getString("ansible.devSpacesBaseUrl"),
    baseUrl: config.getString("ansible.baseUrl"),
    port: config.getOptionalNumber("ansible.port"),
  };
};

export const readAnsibleConfigs = (config: Config): AnsibleDetails => {
  return getHubClusterFromConfig(config);
};
