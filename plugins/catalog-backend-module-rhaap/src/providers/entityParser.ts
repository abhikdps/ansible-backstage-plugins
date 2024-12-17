import {
  ANNOTATION_LOCATION,
  ANNOTATION_ORIGIN_LOCATION,
  Entity,
} from '@backstage/catalog-model';
import { Team, User } from '../client';

export function teamParser(options: {
  baseUrl: string;
  nameSpace: string;
  team: Team;
}): Entity {
  const { baseUrl, team, nameSpace } = options;
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Group',
    metadata: {
      namespace: nameSpace,
      name: team.groupName,
      title: team.name,
      description: team.description,
      annotations: {
        [ANNOTATION_LOCATION]: `url:${baseUrl}/access/teams/${team.id}/details`,
        [ANNOTATION_ORIGIN_LOCATION]: `url:${baseUrl}/access/teams/${team.id}/details`,
      },
    },
    spec: {
      type: 'team',
      children: [],
    },
  };
}

export function userParser(options: {
  baseUrl: string;
  nameSpace: string;
  user: User;
  groupMemberships: string[];
}): Entity {
  const { baseUrl, user, nameSpace, groupMemberships } = options;
  const name =
    user.first_name?.length || user.last_name?.length
      ? `${user.first_name} ${user.last_name}`
      : user.username;

  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'User',
    metadata: {
      namespace: nameSpace,
      name: user.username,
      title: name,
      annotations: {
        [ANNOTATION_LOCATION]: `url:${baseUrl}/access/users/${user.id}/details`,
        [ANNOTATION_ORIGIN_LOCATION]: `url:${baseUrl}/access/users/${user.id}/details`,
      },
    },
    spec: {
      profile: {
        username: user.username,
        displayName: name,
        email: user?.email ? user.email : ' ',
      },
      memberOf: groupMemberships,
    },
  };
}
