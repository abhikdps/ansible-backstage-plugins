# portal-rhdh

`@ansible/portal-rhdh` is the optional native RHDH global-header adapter. Generic
Portal contracts and contributor plugins remain independent of the header
package; the source development app does not need this adapter.

It renders validated Portal Create destinations through RHDH's public component
Blueprint and optionally mounts the existing AAP logout component in the native
profile menu. AAP logout is disabled by default. When enabled, it replaces the
stock logout item and requires the AAP auth frontend/backend integration.

See [header setup](../next/portal-sdk-nfs-composition.md#header-create-actions-and-optional-rhdh-integration)
and [Create authoring](../next/portal-sdk-plugin-author-guide.md#declaring-a-create-destination)
for configuration, permissions, and integration boundaries. The package README
contains export and verification commands.
