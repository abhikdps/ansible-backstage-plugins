import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';

import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import { AAPEntityProvider } from './providers/AAPEntityProvider';

export const catalogModuleRhaap = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'rhaap',
  register(reg) {
    reg.registerInit({
      deps: {
        logger: coreServices.logger,
        catalogProcessing: catalogProcessingExtensionPoint,
        config: coreServices.rootConfig,
        scheduler: coreServices.scheduler,
      },
      async init({ logger, catalogProcessing, config, scheduler }) {
        catalogProcessing.addEntityProvider(
          AAPEntityProvider.fromConfig(config, { logger, scheduler }),
        );
      },
    });
  },
});
