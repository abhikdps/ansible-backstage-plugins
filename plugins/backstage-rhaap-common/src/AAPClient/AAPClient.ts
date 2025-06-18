import {
  LoggerService,
  readSchedulerServiceTaskScheduleDefinitionFromConfig,
  SchedulerService,
  SchedulerServiceTaskRunner,
  SchedulerServiceTaskScheduleDefinition,
} from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';

import * as YAML from 'yaml';
import { Agent, fetch } from 'undici';
import {
  OAuthAuthenticatorResult,
  PassportProfile,
} from '@backstage/plugin-auth-node';
import { AuthenticationError } from '@backstage/errors';

import {
  AAPTemplate,
  CleanUp,
  ExecutionEnvironment,
  JobTemplate,
  LaunchJobTemplate,
  Organization,
  Project,
  AnsibleConfig,
  TokenResponse,
  PaginatedResponse,
  RoleAssignmentResponse,
  RoleAssignments,
  Team,
  User,
  Users,
} from '../types';

import { getAnsibleConfig } from './utils/config';

export interface AAPSubscriptionCheck {
  status: number;
  isValid: boolean;
  isCompliant: boolean;
}

export interface IAAPService
  extends Pick<
    AAPClient,
    | 'executePostRequest'
    | 'executeGetRequest'
    | 'executeDeleteRequest'
    | 'getProject'
    | 'deleteProject'
    | 'deleteProjectIfExists'
    | 'createProject'
    | 'deleteExecutionEnvironmentExists'
    | 'createExecutionEnvironment'
    | 'deleteExecutionEnvironment'
    | 'deleteJobTemplate'
    | 'deleteJobTemplateIfExists'
    | 'createJobTemplate'
    | 'fetchEvents'
    | 'fetchResult'
    | 'launchJobTemplate'
    | 'cleanUp'
    | 'getResourceData'
    | 'getJobTemplatesByName'
    | 'setLogger'
    | 'rhAAPAuthenticate'
    | 'fetchProfile'
    | 'checkSubscription'
    | 'getOrganizationsWithDetails'
    | 'listSystemUsers'
    | 'getTeamsByUserId'
    | 'getUserRoleAssignments'
  > {}

export class AAPClient implements IAAPService {
  static readonly pluginLogName = 'backstage-rhaap-common';
  private readonly config: Config;
  private readonly ansibleConfig: AnsibleConfig;
  private readonly proxyAgent: Agent;
  private readonly pluginLogName: string;
  private logger: LoggerService;
  private hasValidSubscription: boolean = false;
  private isAAPCompliant: boolean = false;
  private statusCode: number = 500;
  private static _instance: AAPClient;
  private readonly scheduleFn: () => Promise<void> = async () => {};

  constructor(options: {
    rootConfig: Config;
    logger: LoggerService;
    scheduler?: SchedulerService;
  }) {
    this.pluginLogName = AAPClient.pluginLogName;
    this.config = options.rootConfig;
    this.ansibleConfig = getAnsibleConfig(this.config);
    this.logger = options.logger;
    this.proxyAgent = new Agent({
      connect: {
        rejectUnauthorized: this.ansibleConfig.rhaap?.checkSSL ?? true,
      },
    });
    const scheduler = options.scheduler;

    if (AAPClient._instance) return AAPClient._instance;

    this.logger.info(`[${this.pluginLogName}] Setting up the scheduler`);

    const DEFAULT_SCHEDULE = {
      frequency: { hours: 24 },
      timeout: { minutes: 1 },
    };
    let schedule: SchedulerServiceTaskScheduleDefinition = DEFAULT_SCHEDULE;
    if (this.config.has('catalog.providers.rhaap.developement.schedule')) {
      schedule = readSchedulerServiceTaskScheduleDefinitionFromConfig(
        this.config.getConfig('catalog.providers.rhaap.developement.schedule'),
      );
    } else if (this.config.has('catalog.providers.rhaap.production.schedule')) {
      schedule = readSchedulerServiceTaskScheduleDefinitionFromConfig(
        this.config.getConfig('catalog.providers.rhaap.production.schedule'),
      );
    }

    if (scheduler) {
      const taskRunner = scheduler.createScheduledTaskRunner(schedule);
      this.scheduleFn = this.createFn(taskRunner);
      const clearSubscriptionCheckTimeout = setTimeout(async () => {
        this.scheduleFn();
        await this.checkSubscription();
        clearTimeout(clearSubscriptionCheckTimeout);
      }, 500);
    }
    AAPClient._instance = this;
  }

  static getInstance(
    config: Config,
    logger: LoggerService,
    scheduler?: SchedulerService,
  ): AAPClient {
    return new AAPClient({ rootConfig: config, logger, scheduler });
  }

  private createFn(taskRunner: SchedulerServiceTaskRunner) {
    return async () =>
      taskRunner.run({
        id: 'backstage-rhaap-subscription-check',
        fn: async () => {
          this.checkSubscription();
        },
      });
  }

  private sleep(ms: number) {
    return new Promise((resolve, _reject) => {
      const timeoutId = setTimeout(() => {
        resolve(undefined);
        clearTimeout(timeoutId);
      }, ms);
    });
  }

  public setLogger(logger: LoggerService) {
    this.logger = logger;
  }

  public async executePostRequest(
    endPoint: string,
    token?: string,
    data?: any,
    auth: boolean = false,
  ): Promise<any> {
    const url = `${this.ansibleConfig.rhaap?.baseUrl}/${endPoint}`;
    this.logger.info(
      `[${this.pluginLogName}]: Executing post request to ${url}.`,
    );

    let requestOptions;

    if (auth && !token) {
      requestOptions = {
        method: 'POST',
        dispatcher: this.proxyAgent,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: data,
      };
    } else {
      requestOptions = {
        method: 'POST',
        dispatcher: this.proxyAgent,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      };
    }

    let response;
    try {
      response = await fetch(url, requestOptions);
    } catch (error) {
      this.logger.error(
        `[${this.pluginLogName}]: Failed to send POST request: ${error}`,
      );
      if (error instanceof Error) {
        throw new Error(`Failed to send POST request: ${error.message}`);
      } else {
        throw new Error(`Failed to send POST request`);
      }
    }
    if (!response.ok) {
      const errorOutput = await response.json();
      this.logger.error(
        `[${this.pluginLogName}] Failed to send POST request: ${response.statusText}`,
      );
      this.logger.error(
        `[${this.pluginLogName}] Error: ${JSON.stringify(errorOutput)}`,
      );
      if (response.status === 403) {
        throw new Error(
          `Insufficient privileges. Please contact your administrator.`,
        );
      } else {
        let errorResponse;
        try {
          errorResponse = await response.json();
        } catch {
          errorResponse = null;
        }
        if (errorResponse) {
          // @ts-ignore
          if (errorResponse?.__all__?.length) {
            // @ts-ignore
            throw new Error(errorResponse.__all__.join(' '));
          } else if (errorResponse.constructor === Object) {
            const errorData = Object.values(errorResponse);
            throw new Error(errorData.join(' '));
          } else {
            throw new Error(`Failed to post data`);
          }
        } else {
          throw new Error(`Failed to post data`);
        }
      }
    }
    return response;
  }

  public async executeGetRequest(
    endPoint: string,
    token: string | null,
    fullUrl?: string,
  ): Promise<any> {
    const baseUrl = this.ansibleConfig.rhaap?.baseUrl ?? '';
    const formattedBaseUrl = baseUrl.endsWith('/')
      ? baseUrl.slice(0, -1)
      : baseUrl;

    const formattedEndPoint = endPoint.startsWith('/')
      ? endPoint
      : `/${endPoint}`;

    const url = fullUrl
      ? `${formattedBaseUrl}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`
      : `${formattedBaseUrl}${formattedEndPoint}`;

    this.logger.info(
      `[${this.pluginLogName}]: Executing get request to ${url}.`,
    );
    const requestOptions = {
      method: 'GET',
      dispatcher: this.proxyAgent,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };
    let response;
    try {
      response = await fetch(url, requestOptions);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to send fetch data: ${error.message}`);
      } else {
        throw new Error(`Failed to send fetch`);
      }
    }
    if (!response.ok) {
      this.logger.error(`[${this.pluginLogName}]: ${response.statusText}`);
      if (response.status === 403) {
        throw new Error(
          `Insufficient privileges. Please contact your administrator.`,
        );
      } else {
        throw new Error(`Failed to fetch data.`);
      }
    }
    return response;
  }

  public async executeDeleteRequest(
    endPoint: string,
    token: string,
  ): Promise<any> {
    const url = `${this.ansibleConfig.rhaap?.baseUrl}/${endPoint}`;
    this.logger.info(
      `[${this.pluginLogName}]: Executing delete request ${url}.`,
    );
    const requestOptions = {
      method: 'DELETE',
      dispatcher: this.proxyAgent,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };
    let response;
    try {
      response = await fetch(url, requestOptions);
    } catch (error) {
      this.logger.error(
        `[${this.pluginLogName}]: Error while executing delete request: ${error}.`,
      );
      if (error instanceof Error) {
        throw new Error(`Failed to send delete: ${error.message}`);
      } else {
        throw new Error(`Failed to send delete`);
      }
    }
    if (!response.ok) {
      this.logger.error(
        `[${this.pluginLogName}]: Error while executing delete request ${response.status}.`,
      );
      if (response.status === 403) {
        throw new Error(
          'Insufficient privileges. Please contact your administrator.',
        );
      } else {
        throw new Error(`Failed to delete`);
      }
    }
    return response;
  }

  public async getProject(projectID: number, token: string): Promise<Project> {
    const endPoint = `api/controller/v2/projects/${projectID}/`;
    const project = await this.executeGetRequest(endPoint, token);
    return (await project.json()) as Project;
  }

  public async deleteProject(projectID: number, token: string): Promise<any> {
    const endPoint = `api/controller/v2/projects/${projectID}/`;
    return await this.executeDeleteRequest(endPoint, token);
  }

  public async deleteProjectIfExists(
    name: string,
    organization: Organization,
    token: string,
  ): Promise<void> {
    this.logger.info(
      `Check if project with name ${name} exist in organization ${organization.name}.`,
    );
    const endPoint = `api/controller/v2/projects/?organization=${organization.id}&name=${name}`;
    const projects = await this.executeGetRequest(endPoint, token);
    const projectList = await projects.json();
    if (projectList.results.length === 1) {
      this.logger.info(`Delete project with id: ${projectList.results[0].id}.`);
      await this.deleteProject(projectList.results[0].id, token);
      this.logger.info(
        `End delete project with id: ${projectList.results[0].id}.`,
      );
    }
  }

  public async createProject(
    payload: Project,
    deleteIfExist: boolean,
    token: string,
  ): Promise<Project> {
    if (deleteIfExist) {
      await this.deleteProjectIfExists(
        payload.projectName,
        payload.organization,
        token,
      );
    }
    const endPoint = 'api/controller/v2/projects/';
    const data = {
      name: payload.projectName,
      description: payload?.projectDescription ?? '',
      organization: payload.organization.id,
      scm_type: 'git',
      scm_url: payload.scmUrl,
      scm_branch: payload?.scmBranch ?? '',
      credential: payload.credentials?.id,
      scm_update_on_launch: payload.scmUpdateOnLaunch,
    };
    this.logger.info(`Begin creating project ${payload.projectName}.`);
    this.logger.info(
      `[${AAPClient.pluginLogName}] Creating new AAP project at ${this.ansibleConfig.rhaap?.baseUrl} in organization ${payload.organization.name}.`,
    );

    const response = await this.executePostRequest(endPoint, token, data);
    this.logger.info(`End creating project ${payload.projectName}.`);

    let projectData = (await response.json()) as Project;
    const waitStatuses = ['new', 'pending', 'waiting', 'running'];

    let projectStatus = projectData.status as string;
    this.logger.info(`Waiting for the project to be ready.`);
    if (waitStatuses.includes(projectStatus)) {
      let shouldWait = true;
      while (shouldWait) {
        await this.sleep(2000);
        projectData = await this.getProject(projectData.id as number, token);
        projectStatus = projectData.status as string;
        if (!waitStatuses.includes(projectStatus)) {
          shouldWait = false;
        }
      }
    }
    if (['failed', 'error', 'canceled'].includes(projectStatus)) {
      this.logger.error(
        `[${this.pluginLogName}] Error creating project: ${projectStatus}`,
      );
      const stdoutEndPoint = `${projectData.related?.last_job}events`;
      const epResponse = await this.executeGetRequest(
        stdoutEndPoint,
        token,
        stdoutEndPoint,
      );
      const respJson = await epResponse.json();
      const stdError = respJson.results.find(
        (item: any) => item.event_data?.res?.msg,
      )?.event_data?.res?.msg;
      this.logger.error(`[${this.pluginLogName}] Error: ${stdError}`);
      throw new Error(`Failed to create project`);
    }
    this.logger.info(`The project is ready.`);
    projectData.url = `${this.ansibleConfig.rhaap?.baseUrl}/execution/projects/${projectData.id}/details`;
    return projectData;
  }

  public async deleteExecutionEnvironmentExists(
    name: string,
    token: string,
  ): Promise<void> {
    this.logger.info(
      `Check if execution environment with name ${name} exist in organization.`,
    );
    const endPoint = `api/controller/v2/execution_environments/?name=${name}`;
    const environments = await this.executeGetRequest(endPoint, token);
    const environmentsList = await environments.json();
    if (environmentsList.results.length === 1) {
      this.logger.info(
        `Delete execution environment with id: ${environmentsList.results[0].id}.`,
      );
      await this.deleteExecutionEnvironment(
        environmentsList.results[0].id,
        token,
      );
      this.logger.info(
        `End delete execution environment with id: ${environmentsList.results[0].id}.`,
      );
    }
  }

  public async createExecutionEnvironment(
    payload: ExecutionEnvironment,
    token: string,
    deleteIfExist?: boolean,
  ): Promise<ExecutionEnvironment> {
    if (deleteIfExist) {
      await this.deleteExecutionEnvironmentExists(
        payload.environmentName,
        token,
      );
    }
    const endPoint = 'api/controller/v2/execution_environments/';
    const data = {
      name: payload.environmentName,
      description: payload?.environmentDescription ?? '',
      organization: payload.organization.id,
      image: payload.image,
      pull: payload.pull,
    };
    this.logger.info(
      `[${this.pluginLogName}] Scaffolder creating new AAP execution environment at ${this.ansibleConfig.rhaap?.baseUrl}.`,
    );
    this.logger.info(
      `Begin creating execution environment ${payload.environmentName}.`,
    );
    const response = await this.executePostRequest(endPoint, token, data);
    this.logger.info(
      `End creating execution environment ${payload.environmentName}.`,
    );
    const eeData = (await response.json()) as ExecutionEnvironment;
    eeData.url = `${this.ansibleConfig.rhaap?.baseUrl}/execution/infrastructure/execution-environments/${eeData.id}/details`;
    return eeData;
  }

  public async deleteExecutionEnvironment(
    environmentID: number,
    token: string,
  ): Promise<any> {
    const endPoint = `api/controller/v2/execution_environments/${environmentID}/`;
    return await this.executeDeleteRequest(endPoint, token);
  }

  public async deleteJobTemplate(
    templateID: number,
    token: string,
  ): Promise<any> {
    const endPoint = `api/controller/v2/job_templates/${templateID}/`;
    return await this.executeDeleteRequest(endPoint, token);
  }

  public async deleteJobTemplateIfExists(
    name: string,
    organization: Organization,
    token: string,
  ): Promise<void> {
    const endPoint = `api/controller/v2/job_templates/?organization=${organization.id}&name=${name}`;
    this.logger.info(
      `Check if job template with name ${name} exist in organization.`,
    );
    const templates = await this.executeGetRequest(endPoint, token);
    const templatesList = await templates.json();
    if (templatesList.results.length === 1) {
      this.logger.info(
        `Delete job template with id: ${templatesList.results[0].id}.`,
      );
      await this.deleteJobTemplate(templatesList.results[0].id, token);
      this.logger.info(
        `End delete job template with id: ${templatesList.results[0].id}.`,
      );
    }
  }

  private async updateUseCaseUrls(
    extraVariables: any,
    git_username: string | undefined,
    git_password: string | undefined,
  ) {
    return {
      ...extraVariables,
      usecases: extraVariables.usecases.map((usecase: any) => ({
        ...usecase,
        url: usecase.url.replace(
          'https://',
          `https://${git_username}:${git_password}@`,
        ),
      })),
    };
  }

  public async createJobTemplate(
    payload: JobTemplate,
    deleteIfExist: boolean,
    token: string,
  ): Promise<JobTemplate> {
    if (deleteIfExist) {
      await this.deleteJobTemplateIfExists(
        payload.templateName,
        payload.organization,
        token,
      );
    }
    const endPoint = 'api/controller/v2/job_templates/';
    let extraVariables;
    extraVariables = payload?.extraVariables
      ? JSON.parse(JSON.stringify(payload.extraVariables))
      : '';
    if (extraVariables !== '') {
      extraVariables.aap_validate_certs = this.ansibleConfig.rhaap?.checkSSL;
      extraVariables.aap_hostname = this.ansibleConfig.rhaap?.baseUrl;
      if (payload.credentials && payload.credentials?.kind === 'scm') {
        let git_password;
        if (payload.scmType === 'Github') {
          git_password = this.ansibleConfig.githubIntegration?.token;
        } else if (payload.scmType === 'Gitlab') {
          git_password = this.ansibleConfig.gitlabIntegration?.token;
        }
        extraVariables = await this.updateUseCaseUrls(
          extraVariables,
          payload.credentials?.inputs?.username,
          git_password,
        );
      }
    }
    const data = {
      name: payload.templateName,
      description: payload?.templateDescription ?? '',
      job_type: 'run',
      inventory: payload.jobInventory.id,
      project: payload.project.id,
      playbook: payload.playbook,
      execution_environment: payload?.executionEnvironment?.id ?? '',
      extra_vars: extraVariables ? YAML.stringify(extraVariables) : '',
    };
    this.logger.info(`Begin creating job template ${payload.templateName}.`);
    const response = await this.executePostRequest(endPoint, token, data);
    const jobTemplate = (await response.json()) as JobTemplate;
    this.logger.info(`End creating job template ${payload.templateName}.`);
    jobTemplate.url = `${this.ansibleConfig.rhaap?.baseUrl}/execution/templates/job-template/${jobTemplate.id}/details`;
    return jobTemplate;
  }

  public async fetchEvents(
    jobID: number,
    token: string,
    results?: never[],
    fullUrl?: string,
  ): Promise<any> {
    let result = results ? results : [];
    const eventsResponse = await this.executeGetRequest(
      `api/controller/v2/jobs/${jobID}/job_events/`,
      token,
      fullUrl,
    );
    const response = await eventsResponse.json();
    result = [...result, ...response.results] as never[];
    if (response.next) {
      return await this.fetchEvents(jobID, token, result, response.next);
    }
    return result;
  }

  public async fetchResult(jobID: number, token: string) {
    let shouldWait = true;
    const endPoint = `api/controller/v2/jobs/${jobID}/`;
    let jobDetailResponseData;
    while (shouldWait) {
      await this.sleep(2000);
      const jobDetailResponse = await this.executeGetRequest(endPoint, token);
      jobDetailResponseData = await jobDetailResponse.json();
      const status = jobDetailResponseData.status;
      if (
        ['successful', 'failed', 'error', 'canceled'].includes(
          status.toString().toLowerCase(),
        )
      ) {
        shouldWait = false;
        break;
      }
    }
    return {
      jobEvents: await this.fetchEvents(jobID, token),
      jobData: jobDetailResponseData,
    };
  }

  public async launchJobTemplate(
    payload: LaunchJobTemplate,
    token: string,
  ): Promise<any> {
    const endPoint = `api/controller/v2/job_templates/${payload.template.id}/launch/`;
    const data = { extra_vars: payload?.extraVariables ?? '' } as {
      inventory?: number;
      job_type?: string;
      executionEnvironment?: number;
      execution_environment?: number;
      forks?: number;
      limit?: string;
      verbosity?: number;
      job_slice_count?: number;
      timeout?: number;
      diff_mode?: boolean;
      job_tags?: string;
      skip_tags?: string;
      extra_vars?: object | string;
      credentials?: number[];
    };
    if (payload?.inventory?.id) {
      data.inventory = payload.inventory.id;
    }
    if (payload?.jobType) {
      data.job_type = payload.jobType;
    }
    if (payload?.executionEnvironment?.id) {
      data.execution_environment = payload.executionEnvironment.id;
    }
    if (payload?.forks || payload.forks === 0) {
      data.forks = payload.forks;
    }
    if (payload?.limit) {
      data.limit = payload.limit;
    }
    if (payload?.verbosity?.id) {
      data.verbosity = payload.verbosity.id;
    }
    if (payload?.jobSliceCount || payload.jobSliceCount === 0) {
      data.job_slice_count = payload.jobSliceCount;
    }
    if (payload?.timeout || payload.timeout === 0) {
      data.job_slice_count = payload.timeout;
    }
    if (payload?.diffMode || payload.diffMode === false) {
      data.diff_mode = payload.diffMode;
    }
    if (payload?.jobTags) {
      data.job_tags = payload.jobTags;
    }
    if (payload?.skipTags) {
      data.skip_tags = payload.skipTags;
    }

    if (payload?.credentials?.length) {
      const seen = new Set();
      const duplicates = [] as string[];
      payload.credentials.some(currentObject => {
        if (seen.size === seen.add(currentObject.credential_type).size) {
          duplicates.push(currentObject.summary_fields.credential_type.name);
          return true;
        }
        return false;
      });
      if (duplicates.length) {
        throw new Error(
          `Cannot assign multiple credentials of the same type. Duplicated credential types are: ${duplicates.join(
            ', ',
          )}`,
        );
      }
      data.credentials = payload.credentials.map(c => c.id);
    }
    this.logger.info(`Start executing job template.`);
    const response = await this.executePostRequest(endPoint, token, data);
    const jobResponseJson = await response.json();
    const jobID = jobResponseJson.job;
    this.logger.info(`Waiting for result of the executed job template.`);

    const result = await this.fetchResult(jobID, token);
    let lastEvent;
    if (result.jobData.status !== 'successful') {
      try {
        const stdoutEndPoint = `api/controller/v2/jobs/${jobID}/stdout/?format=txt`;
        const stdoutResponse = await this.executeGetRequest(
          stdoutEndPoint,
          token,
        );
        const stdoutRespText = await stdoutResponse.text();
        const errorRegex = /"msg":\s*"([^"]+)"/g;
        const matchRegex = [...stdoutRespText.matchAll(errorRegex)];
        lastEvent = matchRegex[matchRegex.length - 1][1];
      } catch (error) {
        lastEvent =
          'Undefined Error. Please check the RHAAP portal for job execution logs.';
        this.logger.error(`${error}`);
      }
      this.logger.error(`Error while executing job template.`);
      this.logger.error(`Job failed: ${lastEvent}`);
      throw new Error(`Job execution failed due to ${lastEvent}`);
    }
    return {
      id: jobID,
      status: result.jobData.status,
      events: result.jobEvents,
      url: `${this.ansibleConfig.rhaap?.baseUrl}/execution/jobs/playbook/${jobID}/output`,
    };
  }

  public async cleanUp(payload: CleanUp, token: string): Promise<void> {
    if (payload?.project?.id) {
      this.logger.info(`Delete project with id ${payload.project.id}.`);
      await this.deleteProject(payload.project.id, token);
    }
    if (payload?.template?.id) {
      this.logger.info(`Delete template with id ${payload.template.id}.`);
      await this.deleteJobTemplate(payload.template.id, token);
    }
    if (payload?.executionEnvironment?.id) {
      this.logger.info(
        `Delete execution environment with id ${payload.executionEnvironment.id}.`,
      );
      await this.deleteExecutionEnvironment(
        payload.executionEnvironment.id,
        token,
      );
    }
  }

  public async getResourceData(resource: string, token: string): Promise<any> {
    const endPoint = `api/controller/v2/${resource}/`;
    const response = await this.executeGetRequest(endPoint, token);
    return await response.json();
  }

  public async getJobTemplatesByName(
    templateNames: string[],
    organization: Organization,
    token: string | null,
  ): Promise<AAPTemplate[]> {
    const endPoint = `api/controller/v2/job_templates/?organization=${organization.id}&name__in=${templateNames}`;
    const response = await this.executeGetRequest(endPoint, token);
    const list = await response.json();
    const results = list.results;
    if (!results?.length) {
      throw new Error(`No job templates found.`);
    }
    return results.map(
      (result: { id: number; name: string }): { id: number; name: string } => {
        return { id: result.id, name: result.name };
      },
    );
  }

  /**
   * Authenticates with Red Hat Ansible Automation Platform (RH AAP) using either an authorization code
   * or a refresh token, and retrieves OAuth tokens.
   *
   * @param options - The authentication options.
   * @param options.host - The RH AAP host URL.
   * @param options.checkSSL - Whether to verify SSL certificates.
   * @param options.clientId - The OAuth client ID.
   * @param options.clientSecret - The OAuth client secret.
   * @param options.callbackURL - The OAuth redirect URI.
   * @param options.code - The authorization code (optional, required for initial authentication).
   * @param options.refreshToken - The refresh token (optional, required for token refresh).
   * @returns An object containing the OAuth session, including access token, token type, scope, expiration, and refresh token.
   * @throws {AuthenticationError} If neither code nor refreshToken is provided, or if authentication fails.
   */
  public async rhAAPAuthenticate(options: {
    host: string;
    checkSSL: boolean;
    clientId: string;
    clientSecret: string;
    callbackURL: string;
    code?: string;
    refreshToken?: string;
  }): Promise<OAuthAuthenticatorResult<PassportProfile>> {
    const endPoint = 'o/token/';
    const data = new URLSearchParams();
    if (options.code) {
      data.append('grant_type', 'authorization_code');
      data.append('code', options.code);
    } else if (options.refreshToken) {
      data.append('grant_type', 'refresh_token');
      data.append('refresh_token', options.refreshToken);
    } else {
      throw new AuthenticationError('You have to provide code or refreshToken');
    }
    data.append('client_id', options.clientId);
    data.append('client_secret', options.clientSecret);
    data.append('redirect_uri', options.callbackURL);
    this.logger.info(
      `[${this.pluginLogName}]: Authenticating with RH AAP at ${this.ansibleConfig.rhaap?.baseUrl}/${endPoint}.`,
    );
    const response = await this.executePostRequest(
      endPoint,
      undefined,
      data,
      true,
    );

    if (!response.ok) {
      throw new AuthenticationError(
        'Failed to obtain access token from RH AAP.',
      );
    }

    const jsonResponse = (await response.json()) as TokenResponse;

    return {
      session: {
        accessToken: jsonResponse.access_token,
        tokenType: jsonResponse.token_type,
        scope: jsonResponse.scope,
        expiresInSeconds: jsonResponse.expires_in,
        refreshToken: jsonResponse.refresh_token,
      },
    } as OAuthAuthenticatorResult<PassportProfile>;
  }

  /**
   * Fetches the user profile data from the Red Hat Ansible Automation Platform (RH AAP)
   * using the provided authentication token.
   *
   * @param token - The OAuth2 access token used for authenticating the request.
   * @returns A promise that resolves to a {@link PassportProfile} object containing the user's
   *          provider, username, email, and display name.
   * @throws {AuthenticationError} If the profile data cannot be retrieved or is in an unexpected format.
   */
  public async fetchProfile(token: string): Promise<PassportProfile> {
    this.logger.info(
      `[${this.pluginLogName}]: Fetching profile data from RH AAP.`,
    );
    let response;
    try {
      const endPoint = 'api/gateway/v1/me/';
      response = await this.executeGetRequest(endPoint, token);
    } catch (e) {
      throw new AuthenticationError(
        'Failed to retrieve profile data from RH AAP.',
      );
    }
    if (!response.ok) {
      throw new AuthenticationError(
        'Failed to retrieve profile data from RH AAP.',
      );
    }
    const userDataJson = (await response.json()) as {
      results: {
        username: string;
        email: string;
        first_name: string;
        last_name: string;
      }[];
    };
    let userData;
    if (
      Object.hasOwn(userDataJson, 'results') &&
      Array.isArray(userDataJson.results) &&
      userDataJson.results?.length
    ) {
      userData = userDataJson.results[0];
    } else {
      throw new AuthenticationError(
        `Profile data from RH AAP is in an unexpected format. Please contact your system administrator`,
      );
    }
    return {
      provider: 'AAP oauth2',
      username: userData.username,
      email: userData.email,
      displayName: `${userData?.first_name ? userData.first_name : ''} ${userData?.last_name ? userData.last_name : ''}`,
    } as PassportProfile;
  }

  private async isAAP25Instance(token: string): Promise<boolean> {
    try {
      const url = `${this.ansibleConfig.rhaap?.baseUrl}/api/gateway/v1/ping/`;
      this.logger.info(`[${this.pluginLogName}] Pinging api gateway at ${url}`);
      const response = await this.executeGetRequest(
        'api/gateway/v1/ping/',
        token,
      );
      return response.ok;
    } catch (error) {
      this.logger.error(
        `[${this.pluginLogName}] Error checking AAP version: ${error}`,
      );
      return false;
    }
  }

  public async checkSubscription(): Promise<AAPSubscriptionCheck> {
    try {
      const token = this.config.getString('ansible.rhaap.token');
      const isAAP25 = await this.isAAP25Instance(token);
      const endpoint = isAAP25 ? 'api/controller/v2/config' : 'api/v2/config';
      this.logger.info(
        `[${this.pluginLogName}] Checking AAP subscription at ${this.ansibleConfig.rhaap?.baseUrl}/${endpoint}`,
      );

      const response = await this.executeGetRequest(endpoint, token);
      const data = await response.json();

      this.statusCode = response.status;
      this.hasValidSubscription = ['enterprise', 'developer', 'trial'].includes(
        data?.license_info?.license_type,
      );

      this.isAAPCompliant = data?.license_info?.compliant ?? false;

      if (this.hasValidSubscription && this.isAAPCompliant) {
        this.logger.info(
          `[${this.pluginLogName}] AAP Subscription Check complete. Subscription is Valid.`,
        );
      }

      return {
        status: this.statusCode,
        isValid: this.hasValidSubscription,
        isCompliant: this.isAAPCompliant,
      };
    } catch (error: any) {
      this.logger.error(
        `[${this.pluginLogName}] AAP subscription check failed: ${error}`,
      );

      if (error.code === 'CERT_HAS_EXPIRED') {
        this.statusCode = 495;
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        this.statusCode = 404;
      } else {
        this.statusCode =
          Number.isInteger(error.code) && error.code >= 100 && error.code < 600
            ? error.code
            : 500;
      }

      return {
        status: this.statusCode,
        isValid: false,
        isCompliant: false,
      };
    }
  }

  private formatNameSpace(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s/g, '-');
  }

  private async executeCatalogRequest(
    endPoint: string,
    token: string | null,
    results?: never[],
  ): Promise<never[]> {
    let result = results ?? [];
    const response = await this.executeGetRequest(endPoint, token);
    const jsonResponse = (await response.json()) as PaginatedResponse;
    result = [...result, ...jsonResponse.results];
    if (jsonResponse.next) {
      return await this.executeCatalogRequest(jsonResponse.next, token, result);
    }
    return result;
  }

  public async getOrganizationsWithDetails(): Promise<
    Array<{
      organization: Organization;
      teams: Team[];
      users: User[];
    }>
  > {
    const orgEndPoint = 'api/controller/v2/organizations/';
    try {
      const token = this.ansibleConfig.rhaap?.token ?? null;
      let orgSync: string;
      if (this.config.has('catalog.providers.rhaap.development')) {
        orgSync =
          this.config.getOptionalString(
            'catalog.providers.rhaap.development.orgs',
          ) ?? '';
      } else if (this.config.has('catalog.providers.rhaap.production')) {
        orgSync =
          this.config.getOptionalString(
            'catalog.providers.rhaap.production.orgs',
          ) ?? '';
      }
      let rawOrgs = await this.executeCatalogRequest(orgEndPoint, token);
      rawOrgs = rawOrgs.filter(
        (org: any) =>
          orgSync.toLocaleLowerCase() === org.name.toLocaleLowerCase(),
      );

      const orgData = await Promise.all(
        rawOrgs.map(async (org: any) => {
          const usersUrl: string | undefined = org.related?.users;
          const teamsUrl: string = org.related.teams;

          const [rawTeams, rawUsers] = await Promise.all([
            teamsUrl ? this.executeCatalogRequest(teamsUrl, token) : [],
            (usersUrl
              ? this.executeCatalogRequest(usersUrl, token)
              : []) as Users,
          ]);

          const users: User[] = rawUsers;
          rawTeams.map(async (team: any) => {
            const teamUsersUrl: string | undefined = team.related?.users;
            if (!teamUsersUrl) {
              return;
            }

            let [teamUsers] = (await Promise.all([
              teamUsersUrl
                ? this.executeCatalogRequest(teamUsersUrl, token)
                : [],
            ])) as Users[];

            teamUsers = teamUsers.map((user: User) => {
              if (!users.includes(user)) {
                user.is_orguser = false;
              }
              return user;
            });
            // merge elements of array rawUsers into the teamUsers
            users.push(...teamUsers);
          });

          const teams: Team[] = (rawTeams || []).map((item: Team) => ({
            id: item.id,
            organization: item.organization,
            name: item.name,
            groupName: item.name.toLowerCase().replace(/\s/g, '-'),
            description: item?.description,
          }));

          return {
            organization: {
              id: org.id,
              name: org.name,
              namespace:
                org.namespace ?? org.name.toLowerCase().replace(/\s/g, '-'),
            },
            teams,
            users,
          };
        }),
      );

      return orgData;
    } catch (err) {
      this.logger.error(
        `Error retrieving organization details from ${orgEndPoint}.`,
      );
      throw new Error(
        `Error retrieving organization details from ${orgEndPoint} : ${err}.`,
      );
    }
  }

  public async listSystemUsers(): Promise<Users> {
    const endPoint = 'api/controller/v2/users/';
    const token = this.ansibleConfig.rhaap?.token ?? null;
    this.logger.info(`Fetching users from RH AAP.`);
    const users = await this.executeCatalogRequest(endPoint, token);
    return users.filter((user: User) => user.is_superuser) as Users;
  }

  public async getTeamsByUserId(
    userID: number,
  ): Promise<{ name: string; groupName: string; id: number; orgId: number }[]> {
    const endPoint = `api/controller/v2/users/${userID}/teams/`;
    const token = this.ansibleConfig.rhaap?.token ?? null;
    this.logger.info(`Fetching teams for user ID: ${userID} from RH AAP.`);
    const teams = await this.executeCatalogRequest(endPoint, token);
    return teams
      .filter((team: any) => team?.name)
      .map((team: any) => ({
        name: team.name,
        groupName: this.formatNameSpace(team.name),
        id: team.id,
        orgId: team.organization,
      }));
  }

  public async getUserRoleAssignments(): Promise<RoleAssignments> {
    const endPoint = 'api/controller/v2/role_user_assignments/';
    const token = this.ansibleConfig.rhaap?.token ?? null;
    this.logger.info(`Fetching role assignments from RH AAP.`);
    const roles = await this.executeCatalogRequest(endPoint, token);
    return roles.reduce(
      (map: RoleAssignments, item: RoleAssignmentResponse) => {
        const tmp = map?.[item.user] ? map[item.user] : {};
        if (item?.summary_fields?.role_definition?.name) {
          const roleDef = tmp?.[item.summary_fields.role_definition.name]
            ? tmp[item.summary_fields.role_definition.name]
            : [];
          if (item?.object_id) {
            roleDef.push(item.object_id);
          }
          tmp[item.summary_fields.role_definition.name] = roleDef;
        }
        map[item.user] = tmp;
        return map;
      },
      {},
    ) as RoleAssignments;
  }
}
