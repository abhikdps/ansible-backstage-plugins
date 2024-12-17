import type {
  LoggerService,
  SchedulerService,
  SchedulerServiceTaskRunner,
} from '@backstage/backend-plugin-api';

import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import type { Config } from '@backstage/config';

import { readAapApiEntityConfigs } from './config';
import { InputError, isError, NotFoundError } from '@backstage/errors';
import { AapConfig } from './types';
import {
  AAPConnector,
  Organizations,
  RoleAssignment,
  RoleAssignments,
  Teams,
  Users,
} from '../client';
import { Entity } from '@backstage/catalog-model';
import { ORGANIZATION_MEMBER, TEAM_MEMBER } from './constants';
import { teamParser, userParser } from './entityParser';

export class AAPEntityProvider implements EntityProvider {
  private readonly env: string;
  private readonly baseUrl: string;
  private readonly logger: LoggerService;
  private readonly scheduleFn: () => Promise<void>;
  private connection?: EntityProviderConnection;
  private readonly accessToken: string;
  private readonly checkSSL: boolean;

  static pluginLogName = 'plugin-catalog-rh-aap';

  static fromConfig(
    config: Config,
    options: {
      logger: LoggerService;
      schedule?: SchedulerServiceTaskRunner;
      scheduler?: SchedulerService;
    },
  ): AAPEntityProvider[] {
    const { logger } = options;
    const providerConfigs = readAapApiEntityConfigs(config);
    logger.info(`Init AAP entity provider from config.`);
    return providerConfigs.map(providerConfig => {
      let taskRunner;
      if ('scheduler' in options && providerConfig.schedule) {
        taskRunner = options.scheduler!.createScheduledTaskRunner(
          providerConfig.schedule,
        );
      } else if ('schedule' in options) {
        taskRunner = options.schedule;
      } else {
        logger.info(
          `[${this.pluginLogName}]:No schedule provided via config for AAP Resource Entity Provider:${providerConfig.id}.`,
        );
        throw new InputError(
          `No schedule provided via config for AapResourceEntityProvider:${providerConfig.id}.`,
        );
      }
      if (!taskRunner) {
        logger.info(
          `[${this.pluginLogName}]:No schedule provided via config for AAP Resource Entity Provider:${providerConfig.id}.`,
        );
        throw new InputError(
          `No schedule provided via config for AapResourceEntityProvider:${providerConfig.id}.`,
        );
      }
      return new AAPEntityProvider(providerConfig, logger, taskRunner);
    });
  }

  private constructor(
    config: AapConfig,
    logger: LoggerService,
    taskRunner: SchedulerServiceTaskRunner,
  ) {
    this.env = config.id;
    this.baseUrl = config.baseUrl;
    this.logger = logger.child({
      target: this.getProviderName(),
    });

    this.scheduleFn = this.createScheduleFn(taskRunner);
    this.accessToken = config.token;
    this.checkSSL = config.checkSSL;
  }

  createScheduleFn(
    taskRunner: SchedulerServiceTaskRunner,
  ): () => Promise<void> {
    return async () => {
      const taskId = `${this.getProviderName()}:run`;
      this.logger.info('[${this.pluginLogName}]:Creating Schedule function.');
      return taskRunner.run({
        id: taskId,
        fn: async () => {
          try {
            await this.run();
          } catch (error) {
            if (isError(error)) {
              // Ensure that we don't log any sensitive internal data:
              this.logger.error(
                `Error while syncing resources from AAP ${this.baseUrl}`,
                {
                  // Default Error properties:
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                  // Additional status code if available:
                  status: (error.response as { status?: string })?.status,
                },
              );
            }
          }
        },
      });
    };
  }

  getProviderName(): string {
    return `AapEntityProvider:${this.env}`;
  }

  async run(): Promise<void> {
    if (!this.connection) {
      throw new NotFoundError('Not initialized');
    }
    let groupCount = 0;
    let usersCount = 0;
    let organizations: Organizations;
    let userRoleAssignments: RoleAssignments;
    let teams = {} as Teams;
    let users = [] as Users;
    const entities: Entity[] = [];
    const nameSpacesGroups = {} as Record<string, string[]>;
    let error = false;
    const apiClient = new AAPConnector({
      logger: this.logger,
      baseUrl: this.baseUrl,
      token: this.accessToken,
      checkSSL: this.checkSSL,
    });
    try {
      organizations = await apiClient.getOrganizationsByID();
      this.logger.info(
        `[${AAPEntityProvider.pluginLogName}]: Fetched ${Object.keys(organizations).length} organizations.`,
      );
    } catch (e: any) {
      this.logger.error(
        `[${AAPEntityProvider.pluginLogName}]: Error while fetching organizations. ${e?.message ?? ''}`,
      );
      error = true;
    }

    try {
      teams = await apiClient.getAllTeamsById();
      this.logger.info(
        `[${AAPEntityProvider.pluginLogName}]: Fetched ${Object.keys(teams).length} teams.`,
      );
    } catch (e: any) {
      this.logger.error(
        `[${AAPEntityProvider.pluginLogName}]: Error while fetching teams. ${e?.message ?? ''}`,
      );
      error = true;
    }

    try {
      users = await apiClient.listUsers();
      this.logger.info(
        `[${AAPEntityProvider.pluginLogName}]: Fetched ${users.length} users.`,
      );
    } catch (e: any) {
      this.logger.error(
        `[${AAPEntityProvider.pluginLogName}]: Error while fetching users. ${e?.message ?? ''}`,
      );
      error = true;
    }

    try {
      userRoleAssignments = await apiClient.getUserRoleAssignments();
    } catch (e: any) {
      this.logger.error(
        `[${AAPEntityProvider.pluginLogName}]: Error while fetching User Role Assignments. ${e?.message ?? ''}`,
      );
      error = true;
    }

    if (!error) {
      Object.values(teams).forEach(team => {
        const teamOrganization = organizations[team?.organization];
        if (teamOrganization) {
          const nameSpace = teamOrganization.namespace;
          const tmp = nameSpacesGroups[nameSpace]
            ? nameSpacesGroups[nameSpace]
            : [];
          tmp.push(team.groupName);
          nameSpacesGroups[nameSpace] = tmp;
          entities.push(teamParser({ baseUrl: this.baseUrl, nameSpace, team }));
          groupCount += 1;
        }
      });
      users.forEach(user => {
        let nameSpaces: string[] = [];
        let userRoleAssignment: RoleAssignment;
        if (user.is_superuser) {
          nameSpaces = Object.values(organizations).map(org => org.namespace);
        } else {
          userRoleAssignment = userRoleAssignments[user.id];
          if (userRoleAssignment?.[ORGANIZATION_MEMBER]?.length) {
            nameSpaces = userRoleAssignment[ORGANIZATION_MEMBER].map(key => {
              const organization = organizations[key as number];
              return organization.namespace;
            });
          } else {
            nameSpaces = ['default'];
          }
        }

        nameSpaces.forEach(nameSpace => {
          let groupMemberships: string[] = [];
          if (user.is_superuser && nameSpacesGroups[nameSpace]?.length) {
            groupMemberships = nameSpacesGroups[nameSpace];
          } else {
            if (
              userRoleAssignment &&
              userRoleAssignment[TEAM_MEMBER]?.length &&
              nameSpacesGroups[nameSpace]?.length
            ) {
              groupMemberships = userRoleAssignment[TEAM_MEMBER].map(key => {
                const group = teams[key as number];
                return nameSpacesGroups[nameSpace].includes(group.groupName)
                  ? group.groupName
                  : '';
              }).filter(x => x?.length);
            }
          }
          entities.push(
            userParser({
              baseUrl: this.baseUrl,
              nameSpace,
              user,
              groupMemberships,
            }),
          );
          usersCount += 1;
        });
      });
      await this.connection.applyMutation({
        type: 'full',
        entities: entities.map(entity => ({
          entity,
          locationKey: this.getProviderName(),
        })),
      });
      this.logger.info(
        `[${AAPEntityProvider.pluginLogName}]: Refreshed ${this.getProviderName()}: ${groupCount} groups added.`,
      );
      this.logger.info(
        `[${AAPEntityProvider.pluginLogName}]: Refreshed ${this.getProviderName()}: ${usersCount} users added.`,
      );
    }
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
    await this.scheduleFn();
  }
}
