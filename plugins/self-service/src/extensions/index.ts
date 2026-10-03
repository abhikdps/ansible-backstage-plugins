/**
 * Extension host for the self-service / portal-core plugin.
 *
 * This directory contains the runtime that renders community plugin
 * contributions into the portal's detail pages and experience slots.
 * It will move to a dedicated `portal-extension-host` package in Phase 7
 * of ANSTRAT-2497 (the rename + restructure phase).
 *
 * Public surface:
 * - `ErrorBoundary` — per-contribution crash isolation
 * - `ExtensionRenderer` exports — `ExtensionTabContent`, `ExtensionCardContent`,
 *   `ExtensionActionMenuItem`, `useActionActivation`
 * - `ExperienceSlot` exports — `ExperienceCardSlot`, `ExperienceTabContent`
 * - `DynamicExtensionDiscovery` — Scalprum loader + no-op fallback
 * - `validateManifest` — host-side manifest validation
 */

export { ErrorBoundary } from './ErrorBoundary';

export {
  ExtensionTabContent,
  ExtensionCardContent,
  ExtensionActionMenuItem,
  useActionActivation,
} from './ExtensionRenderer';

export { ExperienceCardSlot, ExperienceTabContent } from './ExperienceSlot';

export {
  DynamicExtensionDiscovery,
  useIsDynamicEnvironment,
} from './DynamicExtensionDiscovery';

export {
  validateManifest,
  type ManifestValidationResult,
} from './validateManifest';
