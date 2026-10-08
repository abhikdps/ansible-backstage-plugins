import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { portalOperationsServiceRef } from '@ansible/portal-plugin-node';
import { createRouter } from './router';

export default createBackendPlugin({
  pluginId: 'portal-operations',
  register(env) {
    env.registerInit({
      deps: {
        operations: portalOperationsServiceRef,
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        userInfo: coreServices.userInfo,
        permissions: coreServices.permissions,
      },
      async init({ httpRouter, ...options }) {
        // Express 4/5 declaration variance at the Backstage router seam.
        httpRouter.use(
          createRouter(options) as unknown as Parameters<
            typeof httpRouter.use
          >[0],
        );
      },
    });
  },
});
