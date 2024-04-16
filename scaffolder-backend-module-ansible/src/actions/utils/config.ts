import { Config } from '@backstage/config';

export type AnsibleDetails = {
  devSpacesBaseUrl: string;
  port?: number;
  baseUrl?: string;
};

function generateInitUrl(baseUrl: string, port: number): string {
  return `${baseUrl}:${port}/init?`;
}

export const getAnsibleConfig = (config: Config): AnsibleDetails => {
  return {
    devSpacesBaseUrl: config.getString('ansible.devSpacesBaseUrl'),
    baseUrl: config.getString('ansible.ansibleCreatorService.baseUrl'),
    port: parseInt(config.getString('ansible.ansibleCreatorService.port')),
  };
};

export const getAllAnsibleConfig = (config: Config): AnsibleDetails => {
  return getAnsibleConfig(config);
};

export const getDevSpacesUrlFromAnsibleConfig = (config: Config): string => {
  return config.getString('ansible.devSpacesBaseUrl');
};

export const getServiceUrlFromAnsibleConfig = (config: Config): string => {
  return generateInitUrl(config.getString('ansible.ansibleCreatorService.baseUrl'),
        parseInt(config.getString('ansible.ansibleCreatorService.port')) );
};