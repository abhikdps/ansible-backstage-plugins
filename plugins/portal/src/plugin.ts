import {
  createComponentExtension,
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';
import { AapApi } from './apis';

export const portalPlugin = createPlugin({
  id: 'portal',
  apis: [AapApi],
  routes: {
    root: rootRouteRef,
  },
});

export const PortalPage = portalPlugin.provide(
  createRoutableExtension({
    name: 'PortalPage',
    component: () => import('./components/RouteView').then(m => m.RouteView),
    mountPoint: rootRouteRef,
  }),
);

/**
 * @public
 */
export const LocationListener = portalPlugin.provide(
  createComponentExtension({
    name: 'LocationListener',
    component: {
      lazy: () =>
        import('./components/LocationListener').then(m => m.LocationListener),
    },
  }),
);
