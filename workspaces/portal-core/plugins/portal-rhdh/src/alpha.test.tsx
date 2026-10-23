import '@testing-library/jest-dom';
import { screen, fireEvent } from '@testing-library/react';
import { mockApis, renderTestApp } from '@backstage/frontend-test-utils';
import {
  createExtensionInput,
  createFrontendModule,
  createFrontendPlugin,
  PageBlueprint,
  ApiBlueprint,
} from '@backstage/frontend-plugin-api';
import { AppRootWrapperBlueprint } from '@backstage/plugin-app-react';
import { createApiFactory } from '@backstage/core-plugin-api';
import {
  globalHeaderComponentDataRef,
  globalHeaderMenuItemDataRef,
} from '@red-hat-developer-hub/backstage-plugin-global-header';
import { AppHeaderActionBlueprint } from '@ansible/portal-extension-api/alpha';
import { createPortalContributionProvider } from '@ansible/portal-extension-host/alpha';
import { rhAapAuthApiRef } from '@ansible/aap-app-auth';
import portalRhdh from './alpha';

// Exercise the real public Blueprint attachment/data refs without unrelated header widgets.
const headerHost = createFrontendModule({
  pluginId: 'app',
  extensions: [
    AppRootWrapperBlueprint.makeWithOverrides({
      name: 'global-header',
      inputs: {
        components: createExtensionInput([globalHeaderComponentDataRef]),
        menuItems: createExtensionInput([globalHeaderMenuItemDataRef]),
      },
      factory(originalFactory, { inputs }) {
        const components = inputs.components.map(input =>
          input.get(globalHeaderComponentDataRef),
        );
        const menuItems = inputs.menuItems.map(input =>
          input.get(globalHeaderMenuItemDataRef),
        );
        return originalFactory({
          component: ({ children }) => (
            <>
              <div role="toolbar">
                {components.map(({ component: Component }, i) => (
                  <Component key={i} />
                ))}
              </div>
              <div role="menu" aria-label="Profile">
                {menuItems
                  .filter(item => item.target === 'profile')
                  .map(({ component: Component }, i) =>
                    Component ? <Component key={i} /> : null,
                  )}
              </div>
              {children}
            </>
          ),
        });
      },
    }),
  ],
});
const host = createFrontendPlugin({
  pluginId: 'portal',
  extensions: [createPortalContributionProvider()],
});
const permission = {
  type: 'basic' as const,
  name: 'test.create',
  attributes: { action: 'read' as const },
};
function contributor(id: string) {
  return createFrontendPlugin({
    pluginId: id,
    extensions: [
      PageBlueprint.make({
        name: 'create',
        params: {
          path: `/${id}`,
          loader: async () => <div>{id} destination</div>,
        },
      }),
      AppHeaderActionBlueprint.make({
        name: 'create',
        params: {
          group: 'create',
          title: `Create ${id}`,
          targetPage: `page:${id}/create`,
          requiredPermission: permission,
        },
      }),
    ],
  });
}

it('registers only native header attachments and keeps AAP logout opt-in', () => {
  const extensions = (
    portalRhdh as unknown as {
      extensions: Array<{ id: string; disabled: boolean }>;
    }
  ).extensions;
  expect(extensions.map(e => e.id)).toEqual([
    'gh-component:portal-rhdh/create',
    'gh-menu-item:portal-rhdh/aap-logout',
  ]);
  expect(extensions[1].disabled).toBe(true);
});

it('renders nothing without eligible actions and does not require AAP authentication', async () => {
  await renderTestApp({ features: [headerHost, host, portalRhdh] });
  expect(
    screen.queryByRole('button', { name: 'Create...' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('menuitem', { name: 'Sign out' }),
  ).not.toBeInTheDocument();
});

it('uses an independent plugin declaration and follows its effective installed route', async () => {
  await renderTestApp({
    features: [headerHost, host, portalRhdh, contributor('editor')],
    apis: [mockApis.permission()],
    config: {
      app: {
        extensions: [
          { 'page:editor/create': { config: { path: '/new-editor' } } },
        ],
      },
    },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Create...' }));
  expect(await screen.findByText('editor destination')).toBeInTheDocument();
});

it('shows a menu for multiple independently contributed destinations', async () => {
  await renderTestApp({
    features: [
      headerHost,
      host,
      portalRhdh,
      contributor('editor'),
      contributor('builder'),
    ],
    apis: [mockApis.permission()],
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Create...' }));
  fireEvent.click(
    await screen.findByRole('menuitem', { name: 'Create builder' }),
  );
  expect(await screen.findByText('builder destination')).toBeInTheDocument();
});

it('omits a disabled destination without loading a plugin-specific fallback', async () => {
  await renderTestApp({
    features: [headerHost, host, portalRhdh, contributor('editor')],
    apis: [mockApis.permission()],
    config: { app: { extensions: [{ 'page:editor/create': false }] } },
  });
  expect(
    screen.queryByRole('button', { name: 'Create...' }),
  ).not.toBeInTheDocument();
});

it('mounts the existing AAP logout component only when explicitly enabled', async () => {
  const auth = createFrontendModule({
    pluginId: 'app',
    extensions: [
      ApiBlueprint.make({
        name: 'test-aap-auth',
        params: define =>
          define(
            createApiFactory({
              api: rhAapAuthApiRef,
              deps: {},
              factory: () =>
                ({ signOut: jest.fn(), sessionState$: jest.fn() }) as any,
            }),
          ),
      }),
    ],
  });
  await renderTestApp({
    features: [headerHost, host, portalRhdh, auth],
    config: {
      app: { extensions: [{ 'gh-menu-item:portal-rhdh/aap-logout': true }] },
    },
  });
  expect(
    await screen.findByRole('menuitem', { name: 'Sign out' }),
  ).toBeInTheDocument();
});
