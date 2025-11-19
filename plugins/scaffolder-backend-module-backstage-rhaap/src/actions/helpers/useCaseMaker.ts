import { Octokit } from '@octokit/core';
import type { OctokitOptions } from '@octokit/core/dist-types/types.d';
import * as YAML from 'yaml';
import { LoggerService } from '@backstage/backend-plugin-api';
import type { OctokitResponse } from '@octokit/types/dist-types/OctokitResponse';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Git } from './scm';
import {
  GithubIntegrationConfig,
  GitLabIntegrationConfig,
} from '@backstage/integration';
import { randomBytes } from 'crypto';

import {
  AAPTemplate,
  Organization,
  UseCase,
  CreatedTemplate,
  ParsedTemplate,
  BackstageAAPShowcase,
  IAAPService,
  AnsibleConfig,
} from '@ansible/backstage-rhaap-common';

export type GithubConfig = {
  url: string;
  githubRepo: string;
  githubBranch: string;
  githubUser: string;
  githubEmail: string;
  githubToken: string;
  githubOrganizationName: string | null;
};

export type GitLabConfig = {
  url: string;
  gitlabOwner: string;
  gitlabRepo: string;
  gitlabBranch: string;
  gitlabUser: string;
  gitlabEmail: string;
  gitlabToken: string;
  gitlabOrganizationName: string | null;
};

export class UseCaseMaker {
  static pluginLogName =
    'plugin-scaffolder-backend-module-backstage-rhaap:UseCaseMaker';
  private readonly logger: LoggerService;
  private readonly scmType: string;
  private readonly organization!: Organization;
  private apiClient!: IAAPService;
  private ansibleConfig: AnsibleConfig;
  private readonly useCases: UseCase[];
  private showCaseFolder: string;
  private token: string | null;
  private octokit: Octokit;
  private scmIntegration:
    | GithubIntegrationConfig
    | GitLabIntegrationConfig
    | undefined
    | null = null;
  constructor({
    ansibleConfig,
    logger,
    organization,
    scmType,
    apiClient,
    useCases,
    token,
  }: {
    ansibleConfig: AnsibleConfig;
    scmType: string;
    apiClient: IAAPService | null;
    organization: Organization | null;
    logger: LoggerService;
    useCases: UseCase[];
    token: string | null;
  }) {
    this.ansibleConfig = ansibleConfig;
    this.logger = logger;
    this.token = token ?? null;
    this.scmType = scmType;
    if (organization) {
      this.organization = organization;
    }
    if (apiClient) {
      this.apiClient = apiClient;
    }
    this.useCases = useCases;
    this.showCaseFolder =
      this.ansibleConfig.rhaap?.showCaseLocation?.type === 'file'
        ? (this.ansibleConfig.rhaap?.showCaseLocation?.target ?? '')
        : '';
    // Keep for backward compatibility, but prefer URL matching
    if (this.scmType === 'Github') {
      this.scmIntegration = this.ansibleConfig.githubIntegration;
    } else if (this.scmType === 'Gitlab') {
      this.scmIntegration = this.ansibleConfig.gitlabIntegration;
    }
    const octokitOptions = {
      baseUrl: this.scmIntegration?.apiBaseUrl,
    } as OctokitOptions;
    if (this.scmIntegration?.token) {
      octokitOptions.auth = this.scmIntegration?.token;
    }
    this.octokit = new Octokit(octokitOptions);
  }

  /**
   * Helper method to get the correct GitHub integration for a given URL
   */
  private getGitHubIntegrationForUrl(url: string): GithubIntegrationConfig | null {
    if (!this.ansibleConfig.scmIntegrations) {
      return this.ansibleConfig.githubIntegration || null;
    }
    const integration = this.ansibleConfig.scmIntegrations.github.byUrl(url);
    return integration?.config || this.ansibleConfig.githubIntegration || null;
  }

  /**
   * Helper method to get the correct GitLab integration for a given URL
   */
  private getGitLabIntegrationForUrl(url: string): GitLabIntegrationConfig | null {
    if (!this.ansibleConfig.scmIntegrations) {
      return this.ansibleConfig.gitlabIntegration || null;
    }
    const integration = this.ansibleConfig.scmIntegrations.gitlab.byUrl(url);
    return integration?.config || this.ansibleConfig.gitlabIntegration || null;
  }

  private async fetchGithubData(options: {
    url: string;
    repositoryUrl: string;
  }): Promise<OctokitResponse<any, number> | null> {
    const { url, repositoryUrl } = options;
    let response;
    this.logger.info(
      `[${UseCaseMaker.pluginLogName}] Fetching GitHub data ${url}.`,
    );

    // Get the correct integration for this repository URL
    const integration = this.getGitHubIntegrationForUrl(repositoryUrl);
    if (!integration) {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] No GitHub integration found for URL: ${repositoryUrl}`,
      );
      return null;
    }

    // Create Octokit instance with the correct integration
    const octokit = new Octokit({
      auth: integration.token,
      baseUrl: integration.apiBaseUrl,
    });

    try {
      response = await octokit.request(`GET ${url}`, {
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
          accept: 'application/vnd.github+json',
        },
      });
    } catch (e) {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] Error fetching GitHub data ${url}. ${e}`,
      );
    }
    if (response && response.status === 200) {
      return response;
    }
    this.logger.error(
      `[${UseCaseMaker.pluginLogName}] Error fetching GitHub data ${url}.`,
    );
    return null;
  }

  private async fetchGitLabData(options: {
    url: string;
    repositoryUrl: string;
  }): Promise<string | null> {
    const { url, repositoryUrl } = options;
    
    // Get the correct integration for this repository URL
    const integration = this.getGitLabIntegrationForUrl(repositoryUrl);
    if (!integration) {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] No GitLab integration found for URL: ${repositoryUrl}`,
      );
      return null;
    }

    const gitlabApiUrl = integration.apiBaseUrl;
    const headers = new Headers();
    if (integration.token) {
      headers.append('Private-Token', integration.token);
    }
    this.logger.info(
      `[${UseCaseMaker.pluginLogName}] Fetching GitLab data ${url}.`,
    );
    try {
      const response = await fetch(`${gitlabApiUrl}/${url}`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        return response.text();
      }
    } catch (error) {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] Error fetching GitLab data ${url}. ${error}`,
      );
    }
    this.logger.error(
      `[${UseCaseMaker.pluginLogName}] Error fetching GitLab data ${url}.`,
    );
    return null;
  }

  private async getAAPJobTemplate(options: {
    name: string;
  }): Promise<AAPTemplate | null> {
    const { name } = options;
    this.logger.info(
      `[${UseCaseMaker.pluginLogName}] Try to fetch AAP job template ${name}.`,
    );
    let response: { id: number; name: string }[];
    try {
      response = await this.apiClient.getJobTemplatesByName(
        [name],
        this.organization,
        this.token,
      );
    } catch (e) {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] Error while fetching template ${name}: ${e} `,
      );
      return null;
    }
    if (response.length) {
      this.logger.info(
        `[${UseCaseMaker.pluginLogName}] Successfully fetched AAP job template ${name}.`,
      );
      return response[0];
    }
    this.logger.error(
      `[${UseCaseMaker.pluginLogName}] Error while fetching template ${name}: Not found `,
    );
    return null;
  }

  private async getTemplatesLocation(options: {
    userName: string;
    repoName: string;
    branch: string;
    repositoryUrl: string;
  }): Promise<{ path: string; templateName: string }[]> {
    const { userName, repoName, branch, repositoryUrl } = options;
    const locations: { path: string; templateName: string }[] = [];

    const url = `/repos/${userName}/${repoName}/contents/extensions/patterns?ref=${branch}`;
    const locationsResponse = await this.fetchGithubData({ url, repositoryUrl });
    if (!locationsResponse || !Array.isArray(locationsResponse?.data)) {
      this.logger.warn('No locations found.');
      return locations;
    }
    const folders = locationsResponse.data.filter((r: any) => r.type === 'dir');
    this.logger.info(`Found ${folders.length} folders in gitHub.`);
    await Promise.all(
      folders.map(async (folder: any) => {
        this.logger.info(`Search for setup files`);
        const filesUrl = `/repos/${userName}/${repoName}/contents/${folder.path}?ref=${branch}`;
        const filesResponse = await this.fetchGithubData({ url: filesUrl, repositoryUrl });
        if (filesResponse && Array.isArray(filesResponse?.data)) {
          const setupFiles = filesResponse.data.filter(
            (f: any) =>
              f.type === 'file' &&
              (f.name === 'setup.yml' || f.name === 'setup.yaml'),
          );
          if (setupFiles.length) {
            const setupFileUrl = `/repos/${userName}/${repoName}/contents/${setupFiles[0].path}?ref=${branch}`;
            const setupFileResponse = await this.fetchGithubData({
              url: setupFileUrl,
              repositoryUrl,
            });
            if (setupFileResponse?.data?.content) {
              let jsonContent;
              try {
                jsonContent = YAML.parse(atob(setupFileResponse.data.content));
              } catch (e) {
                this.logger.error(
                  ` Error while parsing yaml file ${setupFileUrl}.`,
                );
                this.logger.error(
                  `[${UseCaseMaker.pluginLogName}] Error while parsing yaml file ${setupFileUrl}.`,
                );
              }
              if (
                jsonContent &&
                Array.isArray(jsonContent?.controller_templates)
              ) {
                await Promise.all(
                  jsonContent.controller_templates.map(
                    async (controllerTemplate: any) => {
                      const regex = /.*['"]template_surveys\/([^'"]+)/gm;
                      const templateName = controllerTemplate?.name ?? null;
                      const surveySpec = controllerTemplate?.survey_spec ?? '';
                      const tmp = regex.exec(surveySpec);
                      let filename;
                      if (Array.isArray(tmp) && tmp.length > 1) {
                        filename = tmp[1];
                      } else {
                        this.logger.warn(`Filename of the template not found.`);
                      }
                      if (templateName && filename) {
                        this.logger.info(`Added location for ${templateName}`);
                        locations.push({
                          path: `/repos/${userName}/${repoName}/contents/${folder.path}/template_rhdh/${filename}?ref=${branch}`,
                          templateName: templateName,
                        });
                      }
                    },
                  ),
                );
              }
            }
          } else {
            this.logger.warn(`No setup files found.`);
          }
        }
      }),
    );
    return locations;
  }

  private async getGitLabTemplatesLocation(options: {
    userName: string;
    repoName: string;
    branch: string;
    repositoryUrl: string;
  }): Promise<{ path: string; templateName: string }[]> {
    const { userName, repoName, branch, repositoryUrl } = options;
    const locations: { path: string; templateName: string }[] = [];

    // Get the correct integration for this repository URL
    const integration = this.getGitLabIntegrationForUrl(repositoryUrl);
    if (!integration) {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] No GitLab integration found for URL: ${repositoryUrl}`,
      );
      return locations;
    }

    const gitlabApiUrl = integration.apiBaseUrl;
    const headers: HeadersInit = integration.token
      ? { 'Private-Token': integration.token }
      : {};

    try {
      const locationsResponse = await fetch(
        `${gitlabApiUrl}/projects/${encodeURIComponent(
          userName,
        )}%2F${encodeURIComponent(
          repoName,
        )}/repository/tree?path=extensions/patterns&ref=${encodeURIComponent(
          branch,
        )}`,
        { headers },
      );

      if (!locationsResponse.ok) {
        this.logger.warn(
          `Failed to fetch locations. Status: ${locationsResponse.status}`,
        );
        return locations;
      }

      const locationsData = await locationsResponse.json();

      if (!Array.isArray(locationsData) || locationsData.length === 0) {
        this.logger.warn('No locations found.');
        return locations;
      }

      const folders = locationsData.filter(item => item.type === 'tree');
      this.logger.info(`Found ${folders.length} folders in GitLab.`);

      await Promise.all(
        folders.map(async folder => {
          this.logger.info(`Searching for setup files in ${folder.path}`);
          const filesResponse = await fetch(
            `${gitlabApiUrl}/projects/${encodeURIComponent(
              userName,
            )}%2F${encodeURIComponent(
              repoName,
            )}/repository/tree?path=${encodeURIComponent(
              folder.path,
            )}&ref=${encodeURIComponent(branch)}`,
            { headers },
          );
          if (!filesResponse.ok) {
            this.logger.warn(
              `Failed to fetch files. Status: ${filesResponse.status}`,
            );
            return;
          }
          const filesData = await filesResponse.json();
          if (Array.isArray(filesData)) {
            const setupFiles = filesData.filter(
              file =>
                file.type === 'blob' &&
                (file.name === 'setup.yml' || file.name === 'setup.yaml'),
            );

            if (setupFiles.length) {
              const setupFile = setupFiles[0];

              const setupFileResponse = await fetch(
                `${gitlabApiUrl}/projects/${encodeURIComponent(
                  userName,
                )}%2F${encodeURIComponent(
                  repoName,
                )}/repository/files/${encodeURIComponent(
                  setupFile.path,
                )}/raw?ref=${encodeURIComponent(branch)}`,
                { headers },
              );

              if (!setupFileResponse.ok) {
                this.logger.warn(
                  `Failed to fetch setup file. Status: ${setupFileResponse.status}`,
                );
                return;
              }

              const setupFileData = await setupFileResponse.text();

              let jsonContent;
              try {
                jsonContent = YAML.parse(setupFileData);
              } catch (e) {
                this.logger.error(
                  `Error while parsing YAML file ${setupFile.path}.`,
                );
                return;
              }

              if (
                jsonContent &&
                Array.isArray(jsonContent?.controller_templates)
              ) {
                jsonContent.controller_templates.forEach(
                  (controllerTemplate: any) => {
                    const regex = /.*['"]template_surveys\/([^'"]+)/gm;
                    const templateName = controllerTemplate?.name ?? null;
                    const surveySpec = controllerTemplate?.survey_spec ?? '';
                    const tmp = regex.exec(surveySpec);
                    let filename;

                    if (Array.isArray(tmp) && tmp.length > 1) {
                      filename = tmp[1];
                      this.logger.info(`Filename found ${filename}`);
                    } else {
                      this.logger.warn(`Filename of the template not found.`);
                    }

                    if (templateName && filename) {
                      this.logger.info(`Added location for ${templateName}`);
                      locations.push({
                        path: `projects/${encodeURIComponent(
                          userName,
                        )}%2F${encodeURIComponent(
                          repoName,
                        )}/repository/files/${encodeURIComponent(
                          `${folder.path}/template_rhdh/${filename}`,
                        )}/raw?ref=${encodeURIComponent(branch)}`,
                        templateName,
                      });
                    }
                  },
                );
              }
            } else {
              this.logger.warn(`No setup files found.`);
            }
          }
        }),
      );
    } catch (error) {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] Error fetching GitLab data: ${error}`,
      );
    }

    return locations;
  }

  private async getJsonTemplates(options: {
    useCase: UseCase;
  }): Promise<CreatedTemplate[]> {
    const { useCase } = options;
    const retval = [] as CreatedTemplate[];
    const userName = useCase.url.split('/').slice(-2)[0];
    const repoName = useCase.url.split('/').pop();

    if (!repoName) {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] Can't parse repo name from ${useCase.url}.`,
      );
      throw new Error(`Can't parse repo name from ${useCase.url}.`);
    }
    const branch = useCase.version;
    let templatesLocations: { path: string; templateName: string }[] | null =
      null;

    this.logger.info('Search for use case templates.');
    if (useCase.url.includes('github')) {
      templatesLocations = await this.getTemplatesLocation({
        userName,
        repoName,
        branch,
        repositoryUrl: useCase.url,
      });
    } else if (useCase.url.includes('gitlab')) {
      templatesLocations = await this.getGitLabTemplatesLocation({
        userName,
        repoName,
        branch,
        repositoryUrl: useCase.url,
      });
    }
    if (!templatesLocations) {
      throw new Error('No valid Template location found on the specified url.');
    }
    await Promise.all(
      templatesLocations.map(async location => {
        let template: any = null;
        if (useCase.url.includes('github')) {
          template = await this.fetchGithubData({ url: location.path, repositoryUrl: useCase.url });
        } else if (useCase.url.includes('gitlab')) {
          template = await this.fetchGitLabData({ url: location.path, repositoryUrl: useCase.url });
        }
        let jsonTemplate;
        if (useCase.url.includes('github')) {
          if (template && template?.data.content) {
            try {
              jsonTemplate = YAML.parse(atob(template.data.content));
            } catch (e) {
              this.logger.error(
                `[${UseCaseMaker.pluginLogName}] Error while parsing yaml template ${location.path}.`,
              );
            }
          }
        } else {
          try {
            jsonTemplate = YAML.parse(template);
          } catch (e) {
            this.logger.error(
              `[${UseCaseMaker.pluginLogName}] Error while parsing yaml template ${location.path}.`,
            );
          }
        }
        if (jsonTemplate) {
          retval.push({
            templateName: location.templateName,
            template: jsonTemplate,
          });
        }
      }),
    );
    return retval;
  }

  private parseTemplate(options: {
    jsonData: CreatedTemplate;
  }): ParsedTemplate | null {
    const { jsonData } = options;
    let spec;
    let steps;
    const userTemplate = jsonData.template as {
      metadata?: {
        name?: string;
      };
      spec?: {
        steps?: {
          id: string;
          name: string;
          action: string;
          input: {
            values: {
              templateID?: number;
              template?: { id: number; name: string };
            };
          };
        }[];
      };
    };
    if (Object.hasOwn(userTemplate, 'spec')) {
      spec = userTemplate.spec;
    } else {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] Template configuration incorrect. Missing key spec. ${jsonData.templateName}`,
      );
      return null;
    }
    if (spec && Object.hasOwn(spec, 'steps') && Array.isArray(spec.steps)) {
      steps = spec.steps;
    } else {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] Template configuration incorrect. Missing key spec.steps. ${jsonData.templateName}`,
      );
      return null;
    }
    const index = steps.findIndex(
      s => s.action === 'rhaap:launch-job-template',
    );
    if (index < 0) {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] Template configuration incorrect. Missing action rhaap:launch-job-template ${jsonData.templateName}`,
      );
      return null;
    }
    const action = steps[index];
    if (!action?.input?.values) {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] Template configuration incorrect. Missing keys input.values ${jsonData.templateName}`,
      );
      return null;
    }
    delete action.input.values.templateID;
    if (jsonData.templateId) {
      action.input.values.template = {
        id: jsonData.templateId,
        name: jsonData.templateName,
      };
    } else {
      return null;
    }
    spec.steps[index] = action;
    userTemplate.spec = spec;
    const filename = userTemplate?.metadata?.name ?? null;
    if (!filename) {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] Template configuration incorrect. Missing keys metadata.filename ${jsonData.templateName}`,
      );
      return null;
    }
    return {
      filename: `${filename}.yaml`,
      fileContent: YAML.stringify(userTemplate),
    };
  }

  private createFolder(options: { dirPath: string }) {
    const { dirPath } = options;
    this.logger.info(
      `[${UseCaseMaker.pluginLogName}] Local folder ${dirPath} does not exists. Let's create it.`,
    );
    try {
      fs.mkdirSync(dirPath);
    } catch (e) {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] Error creating local folder ${dirPath}. ${e}`,
      );
      throw new Error(`Error creating local folder ${dirPath}.`);
    }
    this.logger.info(
      `[${UseCaseMaker.pluginLogName}] Created local folder ${dirPath}.`,
    );
  }

  private async createFolderIfNotExists(dirPath: string) {
    this.logger.info(
      `[${UseCaseMaker.pluginLogName}] Check if local folder ${dirPath} exists.`,
    );
    const isDirExist = await fs.promises
      .access(dirPath)
      .then(() => true)
      .catch(() => false);
    if (!isDirExist) {
      this.logger.info(`Creating local folder ${dirPath}`);
      this.createFolder({ dirPath });
    }
    this.logger.info(
      `[${UseCaseMaker.pluginLogName}] Check if local folder ${dirPath}/templates exists.`,
    );
    const isTemplateDirExist = await fs.promises
      .access(`${dirPath}/templates`)
      .then(() => true)
      .catch(() => false);
    if (!isTemplateDirExist) {
      this.logger.info(`Creating local folder ${dirPath}/templates.`);
      this.createFolder({ dirPath: `${dirPath}/templates` });
    }
  }

  private async createAllFile(options: {
    dirPath: string;
    savedTemplates: string[];
    type: string;
  }) {
    const { dirPath, savedTemplates, type } = options;
    let allFileExists;
    const filePath = path.join(dirPath, 'all.yaml');
    try {
      this.logger.info(
        `[${UseCaseMaker.pluginLogName}] Check if file ${filePath} exists.`,
      );
      this.logger.info('Creating file all.yaml');
      allFileExists = await fs.promises
        .access(filePath)
        .then(() => true)
        .catch(() => false);
    } catch (e) {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] Error checking if file  ${filePath} exists. ${e}`,
      );
      throw new Error('Error checking if file all.yaml exists');
    }

    let allFileContent: BackstageAAPShowcase;
    if (allFileExists) {
      try {
        this.logger.info(
          `[${UseCaseMaker.pluginLogName}] File ${filePath} exists. Let's read it.`,
        );
        const data = fs.readFileSync(filePath, 'utf8');
        allFileContent = YAML.parse(data);
      } catch (e) {
        this.logger.info(
          `[${UseCaseMaker.pluginLogName}] Error reading file ${filePath}. ${e}`,
        );
        throw new Error('Error reading file ${filePath}.');
      }
    } else {
      allFileContent = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Location',
        metadata: {
          name: 'aap-showcases-entities',
          description: 'A collection of AAP show cases entities',
        },
        spec: {
          type: type,
          targets: [],
        },
      } as {
        apiVersion: string;
        kind: string;
        metadata: { name: string; description: string };
        spec: { targets: string[] };
      };
    }
    this.logger.info(
      `[${UseCaseMaker.pluginLogName}] Generating file ${filePath} content.`,
    );
    savedTemplates.forEach(savedTemplate => {
      const data = `./templates/${savedTemplate}`;
      if (!allFileContent.spec.targets.includes(data)) {
        allFileContent.spec.targets.push(data);
      }
    });
    try {
      this.logger.info(
        `[${UseCaseMaker.pluginLogName}] Saving file ${filePath}.`,
      );
      this.logger.info(`Saving file ${filePath}.`);
      fs.writeFileSync(filePath, YAML.stringify(allFileContent));
    } catch (e) {
      this.logger.info(
        `[${UseCaseMaker.pluginLogName}] Error saving file ${filePath}. ${e}`,
      );
      throw new Error(`Error saving file ${filePath}.`);
    }
  }

  private async writeLocally(options: {
    parsedTemplates: ParsedTemplate[];
    type?: string;
  }) {
    this.logger.info(`Begin saving templates locally.`);
    const { parsedTemplates, type = 'file' } = options;
    if (!this.ansibleConfig.rhaap?.showCaseLocation) {
      throw new Error('Show case location not defined.');
    }
    const dirPath = this.showCaseFolder;
    if (!dirPath) {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] Ansible show case folder not configured.`,
      );
      throw new Error(`Ansible show case folder not configured.`);
    }

    await this.createFolderIfNotExists(dirPath);
    const savedTemplates = [] as string[];
    parsedTemplates.forEach(template => {
      try {
        this.logger.info(
          `[${UseCaseMaker.pluginLogName}] Saving template ${dirPath}/templates/${template.filename}.`,
        );
        const fileLocation = path.join(dirPath, 'templates', template.filename);
        fs.writeFileSync(fileLocation, template.fileContent);
        savedTemplates.push(template.filename);
      } catch (e) {
        this.logger.error(
          `[${UseCaseMaker.pluginLogName}] Error saving template ${dirPath}/templates/${template.filename}. ${e}`,
        );
      }
    });
    await this.createAllFile({ dirPath, savedTemplates, type });
    this.logger.info(`End saving templates locally.`);
  }

  private async createRepositoryIfNotExists(options: {
    githubConfig: GithubConfig;
  }): Promise<boolean> {
    const { githubConfig } = options;
    
    // Get the correct integration for the repository URL
    const integration = this.getGitHubIntegrationForUrl(githubConfig.url);
    if (!integration) {
      throw new Error(
        `No GitHub integration found for URL: ${githubConfig.url}`
      );
    }

    // Create Octokit instance with the correct integration
    const octokit = new Octokit({
      auth: integration.token,
      baseUrl: integration.apiBaseUrl,
    });

    let response;
    let isNew = false;
    try {
      this.logger.info(
        `[${UseCaseMaker.pluginLogName}] Check if github repo ${githubConfig.githubRepo} exists`,
      );
      this.logger.info(
        `Check if github repo ${githubConfig.githubRepo} exists.`,
      );
      response = await octokit.request('GET /repos/{owner}/{repo}', {
        owner: githubConfig.githubOrganizationName ?? githubConfig.githubUser,
        repo: githubConfig.githubRepo,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
          accept: 'application/vnd.github+json',
        },
      });
    } catch (e: any) {
      if (e?.status === 404) {
        response = null;
      } else {
        this.logger.error(
          `[${UseCaseMaker.pluginLogName}] Error checking if github repo ${githubConfig.githubRepo} exists. ${e}`,
        );
        throw new Error(
          `Error checking if github repo ${githubConfig.githubRepo} exists.`,
        );
      }
    }

    if (response === null) {
      this.logger.info(`Creating gitHub repo ${githubConfig.githubRepo}.`);
      isNew = true;
      this.logger.info(
        `[${UseCaseMaker.pluginLogName}] Github repo ${githubConfig.githubRepo} does not exists. Let's make it.`,
      );
      let createRepoResponse: OctokitResponse<any>;
      try {
        if (githubConfig.githubOrganizationName) {
          createRepoResponse = await octokit.request(
            'POST /orgs/{org}/repos',
            {
              org: githubConfig.githubOrganizationName,
              name: githubConfig.githubRepo,
              headers: {
                'X-GitHub-Api-Version': '2022-11-28',
              },
            },
          );
        } else {
          createRepoResponse = await octokit.request('POST /user/repos', {
            name: githubConfig.githubRepo,
            headers: {
              'X-GitHub-Api-Version': '2022-11-28',
            },
          });
        }
      } catch (e) {
        this.logger.error(
          `[${UseCaseMaker.pluginLogName}] Error creating github repo ${githubConfig.githubRepo}. ${e}`,
        );
        throw new Error(
          `Error creating github repo ${githubConfig.githubRepo}.`,
        );
      }
      if (createRepoResponse.status !== 201) {
        this.logger.error(
          `[${UseCaseMaker.pluginLogName}] Error creating github repo ${githubConfig.githubRepo}.`,
        );
        throw new Error(
          `Error creating github repo ${githubConfig.githubRepo}.`,
        );
      }

      this.logger.info(
        `[${UseCaseMaker.pluginLogName}] Github repo ${githubConfig.githubRepo} successfully created.`,
      );
      this.logger.info(`End creating gitHub repo ${githubConfig.githubRepo}.`);
    } else {
      this.logger.info(`Github repo ${githubConfig.githubRepo} exists.`);
      let branchesResponse;
      try {
        this.logger.info(
          `[${UseCaseMaker.pluginLogName}] Github repo ${githubConfig.githubRepo} exists. Fetching branches`,
        );
        branchesResponse = await octokit.request(
          'GET /repos/{owner}/{repo}/branches',
          {
            owner:
              githubConfig.githubOrganizationName ?? githubConfig.githubUser,
            repo: githubConfig.githubRepo,
            headers: {
              'X-GitHub-Api-Version': '2022-11-28',
            },
          },
        );
      } catch (e) {
        this.logger.error(
          `[${UseCaseMaker.pluginLogName}] Error fetching repo branches ${githubConfig.githubRepo}. ${e}`,
        );
        throw new Error(
          `Error fetching repo branches ${githubConfig.githubRepo}.`,
        );
      }
      if (branchesResponse.status === 200) {
        isNew = branchesResponse.data.length === 0;
      } else {
        this.logger.error(
          `[${UseCaseMaker.pluginLogName}] Error fetching repo branches ${githubConfig.githubRepo}.`,
        );
        throw new Error(
          `Error fetching repo branches ${githubConfig.githubRepo}.`,
        );
      }
    }
    return isNew;
  }

  private async createGitLabRepoIfNotExists(options: {
    gitlabConfig: GitLabConfig;
  }): Promise<boolean> {
    const { gitlabConfig } = options;
    
    // Get the correct integration for the repository URL
    const integration = this.getGitLabIntegrationForUrl(gitlabConfig.url);
    if (!integration || !integration.apiBaseUrl || !integration.token) {
      throw new Error(
        `No GitLab integration found with valid configuration for URL: ${gitlabConfig.url}`
      );
    }

    const gitlabApiUrl = integration.apiBaseUrl;
    const token = integration.token;

    const headers = {
      'PRIVATE-TOKEN': token,
      'Content-Type': 'application/json',
    };

    let isNew = false;
    let response: Response | null = null;

    try {
      this.logger.info(
        `[${UseCaseMaker.pluginLogName}] Checking if GitLab repo ${gitlabConfig.gitlabRepo} exists.`,
      );

      response = await fetch(
        `${gitlabApiUrl}/projects/${encodeURIComponent(
          gitlabConfig.gitlabUser,
        )}%2F${encodeURIComponent(gitlabConfig.gitlabRepo)}`,
        { headers },
      );

      if (!response.ok && response.status !== 404) {
        throw new Error(
          `Error checking GitLab repo: ${response.status} ${response.statusText}`,
        );
      }

      if (response.status === 404) {
        this.logger.info(
          `[${UseCaseMaker.pluginLogName}] GitLab repo ${gitlabConfig.gitlabRepo} does not exist.`,
        );
        response = null;
      }
    } catch (error: any) {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] Error checking GitLab repo ${gitlabConfig.gitlabRepo}: ${error.message}`,
      );
      throw new Error(
        `Error checking GitLab repo ${gitlabConfig.gitlabRepo}: ${error.message}`,
      );
    }

    if (!response) {
      this.logger.info(
        `[${UseCaseMaker.pluginLogName}] Creating GitLab repo ${gitlabConfig.gitlabRepo}.`,
      );
      isNew = true;

      try {
        const namespaceResponse = await fetch(`${gitlabApiUrl}/namespaces`, {
          headers,
        });

        if (!namespaceResponse.ok) {
          throw new Error(
            `Error fetching namespaces: ${namespaceResponse.status} ${namespaceResponse.statusText}`,
          );
        }

        const namespaces = await namespaceResponse.json();
        if (!Array.isArray(namespaces)) {
          throw new Error('Invalid response from GitLab namespaces API.');
        }

        const namespace = namespaces.find(
          (ns: { path: string }) => ns.path === gitlabConfig.gitlabUser,
        );
        if (!namespace) {
          throw new Error(
            `Namespace for user ${gitlabConfig.gitlabUser} not found.`,
          );
        }

        const createRepoResponse = await fetch(`${gitlabApiUrl}/projects`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: gitlabConfig.gitlabRepo,
            namespace_id: namespace.id,
            visibility: 'private',
          }),
        });

        if (createRepoResponse.status !== 201) {
          throw new Error(
            `Unexpected response status ${createRepoResponse.status} while creating repository.`,
          );
        }

        this.logger.info(
          `[${UseCaseMaker.pluginLogName}] GitLab repo ${gitlabConfig.gitlabRepo} successfully created.`,
        );
      } catch (error: any) {
        this.logger.error(
          `[${UseCaseMaker.pluginLogName}] Error creating GitLab repo ${gitlabConfig.gitlabRepo}: ${error.message}`,
        );
        throw new Error(
          `Error creating GitLab repo ${gitlabConfig.gitlabRepo}: ${error.message}`,
        );
      }
    } else {
      this.logger.info(
        `[${UseCaseMaker.pluginLogName}] GitLab repo ${gitlabConfig.gitlabRepo} already exists.`,
      );

      try {
        const branchesResponse = await fetch(
          `${gitlabApiUrl}/projects/${encodeURIComponent(
            gitlabConfig.gitlabUser,
          )}%2F${encodeURIComponent(
            gitlabConfig.gitlabRepo,
          )}/repository/branches`,
          { headers },
        );

        if (!branchesResponse.ok) {
          throw new Error(
            `Error fetching branches: ${branchesResponse.status} ${branchesResponse.statusText}`,
          );
        }

        const branches = await branchesResponse.json();
        if (!Array.isArray(branches)) {
          throw new Error('Unexpected response while fetching branches.');
        }

        isNew = branches.length === 0;
      } catch (error: any) {
        this.logger.error(
          `[${UseCaseMaker.pluginLogName}] Error fetching branches for GitLab repo ${gitlabConfig.gitlabRepo}: ${error.message}`,
        );
        throw new Error(
          `Error fetching branches for GitLab repo ${gitlabConfig.gitlabRepo}: ${error.message}`,
        );
      }
    }

    return isNew;
  }

  private async createGitHubContent(options: {
    githubConfig: GithubConfig;
    parsedTemplates: ParsedTemplate[];
    isNewRepo: boolean;
  }) {
    const { githubConfig, parsedTemplates, isNewRepo } = options;
    const tempDir = os.tmpdir();
    const folderName = `aap_content_${new Date().getTime()}`;
    this.showCaseFolder = path.join(tempDir, folderName);
    this.createFolder({ dirPath: this.showCaseFolder });
    try {
      const git = Git.fromAuth({
        username: githubConfig.githubUser,
        password: githubConfig.githubToken,
      });
      this.logger.info(`[${UseCaseMaker.pluginLogName}] Init git.`);
      await git.init({
        dir: this.showCaseFolder,
        defaultBranch: githubConfig.githubBranch,
      });
      if (isNewRepo) {
        this.logger.info(
          `[${UseCaseMaker.pluginLogName}] Creating new branch ${this.showCaseFolder} - ${githubConfig.githubBranch}.`,
        );
        await git.createBranch({
          dir: this.showCaseFolder,
          ref: githubConfig.githubBranch,
        });
      } else {
        this.logger.info(
          `[${UseCaseMaker.pluginLogName}] Cloning git repo ${githubConfig.url}.git`,
        );
        await git.clone({
          url: `${githubConfig.url}.git`,
          dir: this.showCaseFolder,
        });
        this.logger.info(
          `[${UseCaseMaker.pluginLogName}] Fetching into ${this.showCaseFolder}`,
        );
        await git.fetch({ dir: this.showCaseFolder });
        this.logger.info(
          `[${UseCaseMaker.pluginLogName}] Checkout or create branch ${this.showCaseFolder}`,
        );
        await git.checkoutOrCreate({
          dir: this.showCaseFolder,
          ref: githubConfig.githubBranch,
        });
      }
      this.logger.info(
        `[${UseCaseMaker.pluginLogName}] Creating local content ${this.showCaseFolder}`,
      );
      const type = 'url';
      await this.writeLocally({ parsedTemplates, type });
      this.logger.info(
        `[${UseCaseMaker.pluginLogName}] Commit and push to remote ${this.showCaseFolder}`,
      );
      this.logger.info(`Start commit and push.`);
      await git.commitAndPush({
        url: `${githubConfig.url}.git`,
        dir: this.showCaseFolder,
        gitAuthorInfo: {
          email: githubConfig.githubEmail,
          name: githubConfig.githubUser,
        },
        commitMessage: `AAP showcase templates at: ${new Date().toString()}`,
        branch: githubConfig.githubBranch,
      });
      this.logger.info(`End commit and push.`);
    } catch (e) {
      this.logger.error(`[${UseCaseMaker.pluginLogName}] Git error ${e}`);
      throw new Error(`Something went wrong: ${e}`);
    } finally {
      try {
        this.logger.info(
          `[${UseCaseMaker.pluginLogName}] Removing temp folder ${this.showCaseFolder}`,
        );
        await fs.promises.rm(this.showCaseFolder, {
          recursive: true,
          force: true,
        });
      } catch (e) {
        this.logger.error(
          `[${UseCaseMaker.pluginLogName}] Error while removing temp folder ${this.showCaseFolder} ${e}`,
        );
      }
      this.showCaseFolder = '';
    }
  }

  private async createGitLabContent(options: {
    gitlabConfig: GitLabConfig;
    parsedTemplates: ParsedTemplate[];
    isNewRepo: boolean;
  }) {
    const { gitlabConfig, parsedTemplates, isNewRepo } = options;
    const tempDir = os.tmpdir();
    const folderName = `aap_content_${new Date().getTime()}`;
    this.showCaseFolder = path.join(tempDir, folderName);
    this.createFolder({ dirPath: this.showCaseFolder });
    try {
      const git = Git.fromAuth({
        username: gitlabConfig.gitlabUser,
        password: gitlabConfig.gitlabToken,
      });
      this.logger.info(`[${UseCaseMaker.pluginLogName}] Init git.`);
      await git.init({
        dir: this.showCaseFolder,
        defaultBranch: gitlabConfig.gitlabBranch,
      });
      if (isNewRepo) {
        this.logger.info(
          `[${UseCaseMaker.pluginLogName}] Creating new branch ${this.showCaseFolder} - ${gitlabConfig.gitlabBranch}.`,
        );
        await git.createBranch({
          dir: this.showCaseFolder,
          ref: gitlabConfig.gitlabBranch,
        });
      } else {
        this.logger.info(
          `[${UseCaseMaker.pluginLogName}] Cloning git repo ${gitlabConfig.url}.git`,
        );
        await git.clone({
          url: `${gitlabConfig.url}.git`,
          dir: this.showCaseFolder,
        });
        this.logger.info(
          `[${UseCaseMaker.pluginLogName}] Fetching into ${this.showCaseFolder}`,
        );
        await git.fetch({ dir: this.showCaseFolder });
        this.logger.info(
          `[${UseCaseMaker.pluginLogName}] Checkout or create branch ${this.showCaseFolder}`,
        );
        await git.checkoutOrCreate({
          dir: this.showCaseFolder,
          ref: gitlabConfig.gitlabBranch,
        });
      }
      this.logger.info(
        `[${UseCaseMaker.pluginLogName}] Creating local content ${this.showCaseFolder}`,
      );
      const type = 'url';
      await this.writeLocally({ parsedTemplates, type });
      this.logger.info(
        `[${UseCaseMaker.pluginLogName}] Commit and push to remote ${this.showCaseFolder}`,
      );
      this.logger.info(`Start commit and push.`);
      await git.commitAndPush({
        url: `${gitlabConfig.url}.git`,
        dir: this.showCaseFolder,
        gitAuthorInfo: {
          email: gitlabConfig.gitlabEmail,
          name: gitlabConfig.gitlabUser,
        },
        commitMessage: `AAP showcase templates at: ${new Date().toString()}`,
        branch: gitlabConfig.gitlabBranch,
      });
      this.logger.info(`End commit and push.`);
    } catch (e) {
      this.logger.error(`[${UseCaseMaker.pluginLogName}] Git error ${e}`);
      throw new Error(`Something went wrong: ${e}`);
    } finally {
      try {
        this.logger.info(
          `[${UseCaseMaker.pluginLogName}] Removing temp folder ${this.showCaseFolder}`,
        );
        await fs.promises.rm(this.showCaseFolder, {
          recursive: true,
          force: true,
        });
      } catch (e) {
        this.logger.error(
          `[${UseCaseMaker.pluginLogName}] Error while removing temp folder ${this.showCaseFolder} ${e}`,
        );
      }
      this.showCaseFolder = '';
    }
  }

  private async pushToGithub(options: { parsedTemplates: ParsedTemplate[] }) {
    const { parsedTemplates } = options;
    if (
      !this.ansibleConfig?.rhaap?.showCaseLocation?.target ||
      !this.ansibleConfig?.rhaap?.showCaseLocation?.gitEmail ||
      !this.ansibleConfig?.rhaap?.showCaseLocation?.gitUser
    ) {
      throw new Error('Missing show case target github configuration');
    }

    // Get the correct integration for the showcase URL
    const showcaseUrl = this.ansibleConfig.rhaap.showCaseLocation.target;
    const integration = this.getGitHubIntegrationForUrl(showcaseUrl);
    if (!integration || !integration.token) {
      throw new Error(
        `No GitHub integration found with token for URL: ${showcaseUrl}. ` +
        'Please configure the appropriate GitHub integration in app-config.yaml'
      );
    }

    let url;
    try {
      url = new URL(showcaseUrl);
    } catch (e) {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] Not valid github url ${showcaseUrl}.`,
      );
      throw new Error(
        `Not valid github url ${showcaseUrl}.`,
      );
    }
    const githubConfig = {
      url: `${url.origin}${url.pathname.replace('/orgs/', '/')}`,
      githubBranch: this.ansibleConfig.rhaap.showCaseLocation.gitBranch,
      githubEmail: this.ansibleConfig.rhaap.showCaseLocation.gitEmail,
      githubUser: this.ansibleConfig.rhaap.showCaseLocation.gitUser,
      githubRepo: showcaseUrl
        .split('/')
        .pop(),
      githubToken: integration.token,
      githubOrganizationName: url.pathname.startsWith('/orgs/')
        ? url.pathname.split('/')[2]
        : null,
    } as GithubConfig;

    const isNewRepo = await this.createRepositoryIfNotExists({
      githubConfig,
    });
    this.logger.info(`Start creating gitHub content.`);
    await this.createGitHubContent({
      githubConfig,
      parsedTemplates,
      isNewRepo,
    });
    this.logger.info(`End creating gitHub content.`);
  }

  private async pushToGitLab(options: { parsedTemplates: ParsedTemplate[] }) {
    const { parsedTemplates } = options;
    if (
      !this.ansibleConfig?.rhaap?.showCaseLocation?.target ||
      !this.ansibleConfig?.rhaap?.showCaseLocation?.gitEmail ||
      !this.ansibleConfig?.rhaap?.showCaseLocation?.gitUser
    ) {
      throw new Error('Missing show case target gitlab configuration');
    }

    // Get the correct integration for the showcase URL
    const showcaseUrl = this.ansibleConfig.rhaap.showCaseLocation.target;
    const integration = this.getGitLabIntegrationForUrl(showcaseUrl);
    if (!integration || !integration.token) {
      throw new Error(
        `No GitLab integration found with token for URL: ${showcaseUrl}. ` +
        'Please configure the appropriate GitLab integration in app-config.yaml'
      );
    }

    let url;
    try {
      url = new URL(showcaseUrl);
    } catch (e) {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] Not valid gitlab url ${showcaseUrl}.`,
      );
      throw new Error(
        `Not valid gitlab url ${showcaseUrl}.`,
      );
    }
    const gitlabConfig = {
      url: `${url.origin}${url.pathname.replace('/orgs/', '/')}`,
      gitlabBranch: this.ansibleConfig.rhaap.showCaseLocation.gitBranch,
      gitlabEmail: this.ansibleConfig.rhaap.showCaseLocation.gitEmail,
      gitlabUser: this.ansibleConfig.rhaap.showCaseLocation.gitUser,
      gitlabRepo: showcaseUrl
        .split('/')
        .pop(),
      gitlabToken: integration.token,
      gitlabOrganizationName: url.pathname.startsWith('/orgs/')
        ? url.pathname.split('/')[2]
        : null,
    } as GitLabConfig;

    const isNewRepo = await this.createGitLabRepoIfNotExists({
      gitlabConfig,
    });
    this.logger.info(`Start creating gitLab content.`);
    await this.createGitLabContent({
      gitlabConfig,
      parsedTemplates,
      isNewRepo,
    });
    this.logger.info(`End creating gitLab content.`);
  }

  async devfilePushToGithub(options: { value: string; repositoryUrl: string }) {
    // Use ScmIntegrations to find the matching GitHub integration for this URL
    if (!this.ansibleConfig.scmIntegrations) {
      throw new Error('Missing SCM integrations configuration');
    }

    const integration = this.ansibleConfig.scmIntegrations.github.byUrl(options.repositoryUrl);
    if (!integration) {
      throw new Error(
        `No GitHub integration found for URL: ${options.repositoryUrl}. ` +
        'Please configure the appropriate GitHub integration in app-config.yaml'
      );
    }

    const scmIntegration = integration.config;

    // Extract repository owner and name from the URL using the matched host
    const hostPattern = scmIntegration.host.replace(/\./g, '\\.');
    const repoUrlPattern = new RegExp(`https?:\\/\\/${hostPattern}\\/([^/]+)\\/([^/]+)(?:\\.git)?(?:\\/)?$`);
    const matches = options.repositoryUrl.match(repoUrlPattern);
    if (!matches) {
      throw new Error(
        `Invalid repository URL. Expected format: https://${scmIntegration.host}/owner/repo, got: ${options.repositoryUrl}`
      );
    }

    const owner = matches[1];
    const repo = matches[2];

    if (!scmIntegration.token) {
      throw new Error(`Missing token for GitHub host: ${scmIntegration.host}`);
    }

    // Use the configured apiBaseUrl for Enterprise GitHub support
    const octokit = new Octokit({
      auth: scmIntegration.token,
      baseUrl: scmIntegration.apiBaseUrl,
    });

    // Prepare the content for devfile.yaml (i.e., the raw string value)
    const devfileContent = options.value;

    try {
      // Step 1: Get the repository's default branch
      const { data: repoData } = await octokit.request(
        'GET /repos/{owner}/{repo}',
        {
          owner,
          repo,
        },
      );

      const defaultBranch = repoData.default_branch;

      // Step 2: Get the reference for the default branch (to create a new branch)
      const { data: refData } = await octokit.request(
        'GET /repos/{owner}/{repo}/git/refs/heads/{branch}',
        {
          owner,
          repo,
          branch: defaultBranch,
        },
      );

      // Create a new branch (use the current timestamp to ensure uniqueness)
      if (!refData || !refData.object || !refData.object.sha) {
        this.logger.info(
          'Unable to fetch the latest commit SHA for the default branch',
        );
      }

      const newBranchName = `create-devfile-${randomBytes(2).toString('hex')}`;
      await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
        owner,
        repo,
        ref: `refs/heads/${newBranchName}`,
        sha: refData.object.sha, // Using the sha of the default branch to create the new branch
      });

      // Step 3: Create a new file (devfile.yaml) in the new branch
      const newContent = Buffer.from(devfileContent).toString('base64'); // Base64 encode content for GitHub API
      const commitMessage = 'Create devfile.yaml with new content';
      let shaValue;

      try {
        const result = await octokit.request(
          'GET /repos/{owner}/{repo}/contents/{path}',
          {
            owner,
            repo,
            path: 'devfile.yaml',
            ref: defaultBranch,
          },
        );
        // If the result is an array, we need to extract the sha from the specific file object
        if (Array.isArray(result.data)) {
          // Look for the 'devfile.yaml' file in the directory
          const fileData = result.data.find(
            item => item.path === 'devfile.yaml',
          );
          shaValue = fileData?.sha;
        } else {
          // If the result is a single file, check if it's a file object and contains sha
          if (result.data.sha) {
            shaValue = result.data.sha;
          }
        }
      } catch (error) {
        // If the file doesn't exist, shaValue will remain undefined
        shaValue = undefined;
      }

      await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path: 'devfile.yaml', // Path for the new file
        message: commitMessage,
        content: newContent, // The base64-encoded content of the new file
        branch: newBranchName, // Use the new branch
        sha: shaValue,
      });

      // Step 4: Create a pull request to merge the changes
      const prTitle = 'Add devfile.yaml';
      const prBody =
        'This PR creates a new devfile.yaml file with the provided content.';

      const { data: prData } = await octokit.request(
        'POST /repos/{owner}/{repo}/pulls',
        {
          owner,
          repo,
          title: prTitle,
          head: newBranchName, // The branch with new file
          base: defaultBranch, // The default branch to merge into
          body: prBody,
        },
      );

      this.logger.info(`Pull request created: ${prData.html_url}`);
      return prData.html_url;
    } catch (error) {
      this.logger.error(`Error creating pull request: ${error}`);
      throw error;
    }
  }

  async devfilePushToGitLab(options: { value: string; repositoryUrl: string }) {
    // Use ScmIntegrations to find the matching GitLab integration for this URL
    if (!this.ansibleConfig.scmIntegrations) {
      throw new Error('Missing SCM integrations configuration');
    }

    const integration = this.ansibleConfig.scmIntegrations.gitlab.byUrl(options.repositoryUrl);
    if (!integration) {
      throw new Error(
        `No GitLab integration found for URL: ${options.repositoryUrl}. ` +
        'Please configure the appropriate GitLab integration in app-config.yaml'
      );
    }

    const scmIntegration = integration.config;

    // Extract repository owner and name from the URL using the matched host
    const hostPattern = scmIntegration.host.replace(/\./g, '\\.');
    const repoUrlPattern = new RegExp(`https?:\\/\\/${hostPattern}\\/([^/]+)\\/([^/]+)(?:\\.git)?(?:\\/)?$`);
    const matches = RegExp(repoUrlPattern).exec(options.repositoryUrl);
    if (!matches) {
      throw new Error(
        `Invalid repository URL. Expected format: https://${scmIntegration.host}/owner/repo, got: ${options.repositoryUrl}`
      );
    }

    const owner = matches[1];
    const repo = matches[2];

    if (!scmIntegration.token || !scmIntegration.apiBaseUrl) {
      throw new Error(`Missing token or apiBaseUrl for GitLab host: ${scmIntegration.host}`);
    }

    const headers = {
      'PRIVATE-TOKEN': scmIntegration.token,
      'Content-Type': 'application/json',
    };

    try {
      const repoResponse = await fetch(
        `${scmIntegration.apiBaseUrl}/projects/${encodeURIComponent(
          `${owner}/${repo}`,
        )}`,
        { headers },
      );
      if (!repoResponse.ok) {
        throw new Error(
          `Failed to fetch repository details: ${repoResponse.statusText}`,
        );
      }
      const repoData = await repoResponse.json();
      const defaultBranch = repoData.default_branch;

      const branchName = `create-devfile-${randomBytes(2).toString('hex')}`;
      const branchResponse = await fetch(
        `${scmIntegration.apiBaseUrl}/projects/${repoData.id}/repository/branches`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            branch: branchName,
            ref: defaultBranch,
          }),
        },
      );

      if (!branchResponse.ok) {
        throw new Error(
          `Failed to create new branch: ${branchResponse.statusText}`,
        );
      }

      const devfileContent = Buffer.from(options.value).toString('base64');

      // Check if the file exists
      const fileUrl = `${scmIntegration.apiBaseUrl}/projects/${repoData.id}/repository/files/devfile.yaml?ref=${branchName}`;
      const checkResponse = await fetch(fileUrl, { method: 'GET', headers });

      // Use PUT if exists, else POST
      const method = checkResponse.ok ? 'PUT' : 'POST';

      const fileResponse = await fetch(fileUrl, {
        method: method,
        headers,
        body: JSON.stringify({
          branch: branchName,
          content: devfileContent,
          commit_message: 'Create devfile.yaml with new content',
          encoding: 'base64',
        }),
      });

      if (!fileResponse.ok) {
        throw new Error(
          `Failed to create/update devfile.yaml: ${fileResponse.statusText}`,
        );
      }

      const prResponse = await fetch(
        `${scmIntegration.apiBaseUrl}/projects/${repoData.id}/merge_requests`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            source_branch: branchName,
            target_branch: defaultBranch,
            title: 'Add devfile.yaml',
            description:
              'This MR adds a devfile.yaml file with the provided content.',
          }),
        },
      );

      if (!prResponse.ok) {
        throw new Error(
          `Failed to create merge request: ${prResponse.statusText}`,
        );
      }

      const prData = await prResponse.json();
      this.logger.info(`Merge request created: ${prData.web_url}`);
      return prData.web_url;
    } catch (error) {
      this.logger.error(`Error creating merge request: ${error}`);
      throw error;
    }
  }

  async makeTemplates() {
    if (!this.useCases.length) {
      this.logger.error(
        `[${UseCaseMaker.pluginLogName}] No uses cases provided.`,
      );
      throw new Error('No uses cases provided.');
    }
    const createdTemplates = [] as CreatedTemplate[];
    await Promise.all(
      this.useCases.map(async (useCase: UseCase) => {
        const useCaseTemplates = await this.getJsonTemplates({ useCase });
        useCaseTemplates.forEach(createdTemplate => {
          createdTemplates.push(createdTemplate);
        });
      }),
    );
    const parsedTemplates: ParsedTemplate[] = [];
    await Promise.all(
      createdTemplates.map(async template => {
        const appTemplate = await this.getAAPJobTemplate({
          name: template.templateName,
        });
        if (appTemplate?.id) {
          template.templateId = appTemplate.id;
          const parsedTemplate = this.parseTemplate({ jsonData: template });
          if (parsedTemplate) {
            parsedTemplates.push(parsedTemplate);
          }
        }
      }),
    );
    if (this.ansibleConfig.rhaap?.showCaseLocation?.type === 'url') {
      if (this.scmType === 'Github') {
        await this.pushToGithub({ parsedTemplates });
      } else if (this.scmType === 'Gitlab') {
        await this.pushToGitLab({ parsedTemplates });
      }
    } else {
      await this.writeLocally({ parsedTemplates });
    }
  }
}
