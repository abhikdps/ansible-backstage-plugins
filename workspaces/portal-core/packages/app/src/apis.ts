import {
  ScmIntegrationsApi,
  scmIntegrationsApiRef,
  ScmAuth,
} from '@backstage/integration-react';
import {
  AnyApiFactory,
  configApiRef,
  createApiFactory,
  discoveryApiRef,
  oauthRequestApiRef,
} from '@backstage/core-plugin-api';
import { OAuth2 } from '@backstage/core-app-api';
import { rhAapAuthApiRef } from '@ansible/portal-scaffolder';
import { apmeApiFactory } from '@ansible/plugin-backstage-apme';
import { signalsPlugin } from '@backstage/plugin-signals';
import { portalOperationsApiFactory } from '@ansible/portal-extension-api';

export const apis: AnyApiFactory[] = [
  ...signalsPlugin.getApis(),
  apmeApiFactory,
  portalOperationsApiFactory,
  createApiFactory({
    api: scmIntegrationsApiRef,
    deps: { configApi: configApiRef },
    factory: ({ configApi }) => ScmIntegrationsApi.fromConfig(configApi),
  }),
  ScmAuth.createDefaultApiFactory(),
  createApiFactory({
    api: rhAapAuthApiRef,
    deps: {
      discoveryApi: discoveryApiRef,
      oauthRequestApi: oauthRequestApiRef,
      configApi: configApiRef,
    },
    factory: ({ discoveryApi, oauthRequestApi, configApi }) =>
      OAuth2.create({
        configApi,
        discoveryApi,
        oauthRequestApi,
        provider: {
          id: 'rhaap',
          title: 'RH AAP',
          icon: () => null,
        },
        environment: configApi.getOptionalString('auth.environment'),
        defaultScopes: ['read', 'write'],
      }),
  }),
];
