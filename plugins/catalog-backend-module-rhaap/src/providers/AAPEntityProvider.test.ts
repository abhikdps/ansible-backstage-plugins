import { ConfigReader } from '@backstage/config';
import {
  MOCK_BASE_URL,
  MOCK_CONFIG,
  MOCK_ORGANIZATION_RESPONSE,
  MOCK_ROLE_ASSIGNMENT_RESPONSE,
  MOCK_TEAMS_RESPONSE,
  MOCK_USERS_RESPONSE,
} from '../mock';
import { AAPEntityProvider } from './AAPEntityProvider';
import {
  SchedulerServiceTaskInvocationDefinition,
  SchedulerServiceTaskRunner,
} from '@backstage/backend-plugin-api';
import { mockServices } from '@backstage/backend-test-utils';
import { EntityProviderConnection } from '@backstage/plugin-catalog-node';

jest.mock('undici', () => ({
  ...jest.requireActual('undici'),
  fetch: jest.fn(async (input: any) => {
    if (input === `${MOCK_BASE_URL}/api/gateway/v1/organizations/`) {
      return Promise.resolve(MOCK_ORGANIZATION_RESPONSE);
    }
    if (input === `${MOCK_BASE_URL}/api/gateway/v1/teams/`) {
      return Promise.resolve(MOCK_TEAMS_RESPONSE);
    }
    if (input === `${MOCK_BASE_URL}/api/gateway/v1/users/`) {
      return Promise.resolve(MOCK_USERS_RESPONSE);
    }
    if (input === `${MOCK_BASE_URL}/api/gateway/v1/role_user_assignments/`) {
      return Promise.resolve(MOCK_ROLE_ASSIGNMENT_RESPONSE);
    }
    return null;
  }),
}));

class PersistingTaskRunner implements SchedulerServiceTaskRunner {
  private tasks: SchedulerServiceTaskInvocationDefinition[] = [];

  getTasks() {
    return this.tasks;
  }

  run(task: SchedulerServiceTaskInvocationDefinition): Promise<void> {
    this.tasks.push(task);
    return Promise.resolve(undefined);
  }
}

describe('AAPEntityProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const expectedEntities = [
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Group',
      metadata: {
        namespace: 'default',
        name: 'team-a-1',
        title: 'Team A',
        description: 'Team A description',
        annotations: {
          'backstage.io/managed-by-location':
            'url:https://rhaap.test/access/teams/1/details',
          'backstage.io/managed-by-origin-location':
            'url:https://rhaap.test/access/teams/1/details',
        },
      },
      spec: { type: 'team', children: [] },
    },

    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Group',
      metadata: {
        namespace: 'default',
        name: 'team-b-2',
        title: 'Team B',
        description: 'Team B description',
        annotations: {
          'backstage.io/managed-by-location':
            'url:https://rhaap.test/access/teams/2/details',
          'backstage.io/managed-by-origin-location':
            'url:https://rhaap.test/access/teams/2/details',
        },
      },
      spec: { type: 'team', children: [] },
    },

    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Group',
      metadata: {
        namespace: 'test-organization',
        name: 'team-a-3',
        title: 'Team A',
        description: 'Team A test organization ',
        annotations: {
          'backstage.io/managed-by-location':
            'url:https://rhaap.test/access/teams/3/details',
          'backstage.io/managed-by-origin-location':
            'url:https://rhaap.test/access/teams/3/details',
        },
      },
      spec: { type: 'team', children: [] },
    },

    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'User',
      metadata: {
        namespace: 'default',
        name: 'user1',
        title: 'User1 first name User1 last name',
        annotations: {
          'backstage.io/managed-by-location':
            'url:https://rhaap.test/access/users/1/details',
          'backstage.io/managed-by-origin-location':
            'url:https://rhaap.test/access/users/1/details',
        },
      },
      spec: {
        profile: {
          username: 'user1',
          displayName: 'User1 first name User1 last name',
          email: 'user1@test.com',
        },
        memberOf: ['team-a-1', 'team-b-2'],
      },
    },

    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'User',
      metadata: {
        namespace: 'test-organization',
        name: 'user1',
        title: 'User1 first name User1 last name',
        annotations: {
          'backstage.io/managed-by-location':
            'url:https://rhaap.test/access/users/1/details',
          'backstage.io/managed-by-origin-location':
            'url:https://rhaap.test/access/users/1/details',
        },
      },
      spec: {
        profile: {
          username: 'user1',
          displayName: 'User1 first name User1 last name',
          email: 'user1@test.com',
        },
        memberOf: ['team-a-3'],
      },
    },

    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'User',
      metadata: {
        namespace: 'default',
        name: 'user2',
        title: 'User2 first name User2 last name',
        annotations: {
          'backstage.io/managed-by-location':
            'url:https://rhaap.test/access/users/2/details',
          'backstage.io/managed-by-origin-location':
            'url:https://rhaap.test/access/users/2/details',
        },
      },
      spec: {
        profile: {
          username: 'user2',
          displayName: 'User2 first name User2 last name',
          email: 'user2@test.com',
        },
        memberOf: ['team-a-1'],
      },
    },
  ].map(entity => ({
    entity,
    locationKey: 'AapEntityProvider:dev',
  }));

  const expectMutation = async () => {
    const config = new ConfigReader(MOCK_CONFIG.data);
    const logger = mockServices.logger.mock();
    const schedulingConfig: Record<string, any> = {};

    const schedule = new PersistingTaskRunner();
    const entityProviderConnection: EntityProviderConnection = {
      applyMutation: jest.fn(),
      refresh: jest.fn(),
    };

    schedulingConfig.schedule = schedule;
    const provider = AAPEntityProvider.fromConfig(config, {
      ...schedulingConfig,
      logger,
    })[0];

    expect(provider.getProviderName()).toEqual('AapEntityProvider:dev');

    try {
      await provider.connect(entityProviderConnection);
    } catch (error) {
      console.error('Error during provider connection:', error);
    }

    const taskDef = schedule.getTasks()[0];
    expect(taskDef.id).toEqual('AapEntityProvider:dev:run');

    await (taskDef.fn as () => Promise<void>)();

    expect(entityProviderConnection.applyMutation).toHaveBeenCalledWith({
      type: 'full',
      entities: expectedEntities,
    });
    return true;
  };

  it('test', async () => {
    const result = await expectMutation();
    expect(result).toBe(true);
  });
});
