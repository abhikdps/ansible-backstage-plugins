import {
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import {
  ansibleServiceRef,
  userProvisionerRef,
  UserProvisioner,
} from '@ansible/backstage-rhaap-common';
import { UserProvisionerProvider } from './UserProvisionerProvider';

export const catalogModuleRhaapUserProvisioner = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'rhaap-user-provisioner',
  register(reg) {
    reg.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        ansibleService: ansibleServiceRef,
        userProvisioner: userProvisionerRef,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
      },
      async init({ catalog, ansibleService, userProvisioner, config, logger }) {
        const provider = new UserProvisionerProvider({
          ansibleService,
          config,
          logger,
        });

        // Wire the provider's createUser method into the shared service ref instance.
        // The UserProvisioner singleton is root-scoped, so the auth module
        // receives the same instance and can call createUser() directly.
        (userProvisioner as UserProvisioner).registerCreateUserFn(
          (username, userID) => provider.createUser(username, userID),
        );

        catalog.addEntityProvider(provider);
      },
    });
  },
});
