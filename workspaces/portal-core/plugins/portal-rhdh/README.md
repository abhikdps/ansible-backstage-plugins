# @ansible/portal-rhdh

Optional native RHDH header integration for Automation Portal. This package
adapts Portal Create declarations and the existing AAP logout component to
RHDH's public global-header Blueprints. It does not replace the platform header.

Generic SDK contracts and contributor plugins do not depend on the RHDH header.
Only this integration package imports
`@red-hat-developer-hub/backstage-plugin-global-header`. The source development
app renders its own header and does not need this package.

## Prerequisites

- An NFS RHDH app with the global-header frontend feature installed.
- The Portal contribution provider from `@ansible/portal-core` and compatible
  SDK/contributor artifacts built from the same checkout.
- This adapter's native `./alpha` feature installed through dynamic discovery.
- For AAP logout only: the `@ansible/aap-app-auth` native auth module, its
  backend provider, and frontend-visible AAP connection configuration.

The adapter builds against global-header `3.2.1` and frontend-plugin-api
`0.18.0`. The generic Portal Blueprint contracts remain on their existing
platform dependency baseline. Verification targets RHDH `next-2.1`; this is not
a supported cross-version compatibility matrix.

## Installing the adapter

From the repository root, export the plugin:

```bash
yarn workspace @ansible/portal-rhdh export-dynamic
```

Install the resulting `dist-dynamic` directory or packed dynamic artifact using
the deployment's normal dynamic plugin configuration. SDK workspace libraries
are consumed through their host/contributor artifacts, not installed as pages.
The automation-portal-local native development selections include this adapter.

Merge these entries into the existing `app.extensions` list to replace the
stock header Create shortcut:

```yaml
app:
  extensions:
    - gh-component:global-header/self-service-button: false
```

The adapter's `gh-component:portal-rhdh/create` extension is enabled by default.
It consumes validated Create destinations through the host resolver. No eligible
destination means no button; one destination opens directly; multiple
destinations open a menu. Declared permissions must resolve to allow. The target
must be an installed page owned by the declaring plugin; effective page-path
overrides are respected. This is UI navigation, not a backend operation launch.
Destination pages and backend handlers retain their own authorization checks.

## Opting in to AAP logout

AAP logout is disabled by default, and Create does not require AAP authentication.
When AAP authentication is installed, merge both entries below into the same
`app.extensions` list:

```yaml
app:
  extensions:
    - gh-menu-item:global-header/logout: false
    - gh-menu-item:portal-rhdh/aap-logout: true
```

Keep the stock logout item when AAP logout is not enabled. Do not replace the
entire extensions list or remove other auth/navigation configuration.

The native profile-menu attachment lazily reuses `AAPLogoutButton` from
`@ansible/aap-app-auth`. It clears the Portal auth session and redirects this
browser to AAP's `/api/gateway/v1/logout/`. Configure a browser-reachable AAP URL
under `ansible.rhaap.baseUrl`; a container-only hostname cannot serve that
redirect. The optional AAP peer dependency must be available when enabling this
extension. Missing auth APIs are not a substitute for a configured provider.

Do not use legacy `mountPoints: global.header/profile` YAML for this native
adapter. The existing native AAP auth artifact does not expose that legacy
mount-point integration. This change does not add token-exchange retries or fix
intermittent AAP OAuth transport failures.

## Verification

```bash
yarn test --runInBand workspaces/portal-core/plugins/portal-rhdh
yarn workspace @ansible/portal-rhdh lint
yarn tsc
```

On the target RHDH deployment, verify no duplicate Create/logout items, navigation
to the installed contributor's effective page path, and omission of unavailable
destinations. With AAP logout explicitly enabled, check the profile menu and
confirm Sign out clears Portal authentication and redirects to AAP logout.
That last check ends the current browser's session; use a test session.

See the [Create authoring contract](../../../../docs/next/portal-sdk-plugin-author-guide.md#declaring-a-create-destination)
and [NFS composition guide](../../../../docs/next/portal-sdk-nfs-composition.md)
for contributor declarations and host configuration.
