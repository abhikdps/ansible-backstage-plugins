import type { CatalogClient } from '@backstage/catalog-client';
import type {
  AuthService,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import { catalogEntityReadPermission } from '@backstage/plugin-catalog-common/alpha';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { InputError, NotAllowedError, NotFoundError } from '@backstage/errors';
import type { PortalOperations } from '@ansible/portal-plugin-node';
import {
  apmeQualityScanOperation,
  type IApmeService,
  normalizeRepoUrlFromEntity,
  defaultBranchFromEntity,
} from '@ansible/backstage-apme-common';

export function registerApmeOperations(options: {
  operations: PortalOperations;
  catalogClient: CatalogClient;
  auth: AuthService;
  permissions: PermissionsService;
  apmeService: IApmeService;
  resolveScanVersion(projectId: string): Promise<string | undefined>;
  resolveEnableAi(): Promise<boolean>;
}) {
  options.operations.register({
    pluginId: 'apme',
    descriptor: apmeQualityScanOperation,
    async handler({ subject }, context) {
      const [decision] = await options.permissions.authorize(
        [
          {
            permission: catalogEntityReadPermission,
            resourceRef: subject.entityRef,
          },
        ],
        { credentials: context.credentials },
      );
      if (decision?.result !== AuthorizeResult.ALLOW) {
        throw new NotAllowedError('Repository access denied');
      }
      const { token } = await options.auth.getPluginRequestToken({
        onBehalfOf: context.credentials,
        targetPluginId: 'catalog',
      });
      const entity = await options.catalogClient.getEntityByRef(
        subject.entityRef,
        { token },
      );
      if (!entity) throw new NotFoundError('Repository not found');
      if (
        entity.kind.toLowerCase() !== 'component' ||
        entity.spec?.type !== 'git-repository'
      ) {
        throw new InputError('Quality scan requires a Git repository');
      }
      // PoC organization convention: identity and repository catalog namespace.
      // This is deliberately restrictive until the organization resolver is agreed.
      if ((entity.metadata.namespace ?? 'default') !== context.organizationId) {
        throw new NotAllowedError(
          'Repository is outside the active organization',
        );
      }
      const repoUrl = normalizeRepoUrlFromEntity(entity);
      if (!repoUrl) throw new InputError('Repository has no source URL');
      const project = await options.apmeService.getProjectByRepoUrl(
        repoUrl,
        defaultBranchFromEntity(entity),
      );
      if (!project)
        throw new NotFoundError('Repository has no APME project yet');
      return options.apmeService.triggerScan(project.id, {
        ansibleVersion: await options.resolveScanVersion(project.id),
        enableAi: await options.resolveEnableAi(),
        userIdentity: { userEntityRef: context.userEntityRef },
      });
    },
  });
}
