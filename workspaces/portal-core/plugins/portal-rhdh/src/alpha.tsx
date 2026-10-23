import { createFrontendPlugin } from '@backstage/frontend-plugin-api';
import { compatWrapper } from '@backstage/core-compat-api';
import {
  GlobalHeaderComponentBlueprint,
  GlobalHeaderMenuItemBlueprint,
} from '@red-hat-developer-hub/backstage-plugin-global-header';

/** Install only in RHDH; neither generic SDK contracts nor contributors import this plugin. */
export default createFrontendPlugin({
  pluginId: 'portal-rhdh',
  extensions: [
    GlobalHeaderComponentBlueprint.make({
      name: 'create',
      params: {
        priority: 90,
        loader: () =>
          import('./RhdhCreateAction').then(m => m.RhdhCreateAction),
      },
    }),
    // Explicit opt-in: generic Create integration must not enable AAP authentication.
    GlobalHeaderMenuItemBlueprint.make({
      name: 'aap-logout',
      disabled: true,
      params: {
        target: 'profile',
        priority: 10,
        loader: async () => {
          const { AAPLogoutButton } = await import('@ansible/aap-app-auth');
          return () => compatWrapper(<AAPLogoutButton />);
        },
      },
    }),
  ],
});
