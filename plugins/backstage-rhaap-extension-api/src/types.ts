import type { LazyExoticComponent, ComponentType } from 'react';
import type { Entity } from '@backstage/catalog-model';
import type { ApiRef } from '@backstage/core-plugin-api';
import type { BasicPermission } from '@backstage/plugin-permission-common';

/** A React component that may be lazy-loaded or synchronous.
 *  `ExtensionRenderer` always wraps in `<Suspense>` — the fallback
 *  never activates for synchronous components. */
export type ContributionComponent =
  LazyExoticComponent<ComponentType<any>> | ComponentType<any>;

/**
 * How a capability entry point connects to UI or a server-side effect.
 *
 * - `'slot'` — mounts a federated module (`moduleName`) into a named layout
 *   zone (`targetSlot`) inside the experience. Pure React — no network call
 *   at registration time.
 * - `'workflow'` — starts a host-owned guided walkthrough (`workflowId`).
 *   The host routes to it; the plugin does not provide a URL.
 * - `'operation'` — invokes a registered server-side operation (`operationId`).
 *   The operation handler lives on the plugin backend, behind permission,
 *   audit, and identity pipeline. Use this for any server-side effect.
 *
 * **Security invariant:** Plugins must not pass `apiEndpoint` or a fetch URL
 * for server effects. Every server call goes through an `operationId`.
 */
export type CapabilityLaunchType = 'slot' | 'workflow' | 'operation';

export interface CapabilityLaunch {
  type: CapabilityLaunchType;
  /** `slot` — federated module name resolved by the host (Scalprum). */
  moduleName?: string;
  /** `slot` — named layout zone inside the experience (e.g. `'content-authoring.overview'`). */
  targetSlot?: string;
  /** `workflow` — ID of a host-owned guided walkthrough. */
  workflowId?: string;
  /** `operation` — ID of a registered server-side operation. */
  operationId?: string;
}

/**
 * Context passed to an action's `onActivate` callback at invocation time.
 *
 * **`onActivate` is for pure UI effects only** — navigation, opening a dialog,
 * toggling a state flag. For any server-side effect use `launches` with
 * `type: 'operation'` or `type: 'workflow'` instead.
 */
export interface ActionContext {
  entity: Entity;
  /**
   * Resolves a Backstage API by ref. Equivalent to `useApi()` but callable
   * outside a React component. Built by `ExtensionRenderer` via
   * `useApiHolder()` at render time.
   *
   * @example
   * onActivate: ({ entity, getApi }) => {
   *   const catalogApi = getApi(catalogApiRef);
   *   catalogApi.refreshEntity(entity.metadata.name);  // UI-side refresh only
   * }
   */
  getApi: <T>(apiRef: ApiRef<T>) => T;
}

export interface TabContribution {
  id: string;
  label: string;
  icon?: ComponentType<{ fontSize?: 'small' | 'default' | 'large' }>;
  component: ContributionComponent;
  /**
   * Content type IDs this tab applies to. The host evaluates this statically
   * before mounting — it is the primary visibility gate.
   *
   * Use the canonical IDs from `CONTENT_TYPES`:
   * `'collection'`, `'execution-environment-definition'`,
   * `'execution-environment-image'`, `'playbook-repository'`.
   *
   * Omit (or use `'*'`) to apply to every content type on this extension point.
   *
   * @example
   * appliesToContentTypes: ['playbook-repository']
   */
  appliesToContentTypes?: string[] | '*';
  /**
   * Additional entity-level visibility predicate. Evaluated only after
   * `appliesToContentTypes` passes. Called inside a `try/catch` — a throwing
   * filter is treated as "don't show" and logs a warning.
   *
   * Prefer `appliesToContentTypes` for type-based filtering; use `filter` only
   * for entity-attribute conditions (e.g. "show only when entity has annotation X").
   */
  filter?: (entity: Entity) => boolean;
  /**
   * Permission gate evaluated by `ExtensionRenderer`. The slot is hidden from
   * users who lack this permission. Omit for no permission gate.
   */
  permission?: BasicPermission;
  /**
   * Sort order within the tab strip. Lower = further left.
   * Built-in tabs use 0–20; community tabs should use 21+ to appear after
   * built-ins. Negative values are allowed. Equal priorities are ordered by
   * insertion order (stable sort).
   */
  priority?: number;
}

export interface CardContribution {
  id: string;
  slot: 'overview-left' | 'overview-right' | 'sidebar' | string;
  component: ContributionComponent;
  /** Content type IDs this card applies to. See `TabContribution.appliesToContentTypes`. */
  appliesToContentTypes?: string[] | '*';
  filter?: (entity: Entity) => boolean;
  permission?: BasicPermission;
  priority?: number;
}

export interface ActionContribution {
  id: string;
  label: string;
  icon?: ComponentType;
  /**
   * Pure-UI activation callback — navigation, opening a dialog, toggling a
   * state flag. **Must not make server calls or trigger server-side effects.**
   *
   * For server-side effects use `launches` with `type: 'operation'` or
   * `type: 'workflow'`.
   */
  onActivate: (context: ActionContext) => void | Promise<void>;
  /**
   * How this action connects to a server-side workflow or operation.
   * Provide this alongside (or instead of) `onActivate` when the action
   * causes a server-side effect.
   */
  launches?: CapabilityLaunch;
  /** Content type IDs this action applies to. See `TabContribution.appliesToContentTypes`. */
  appliesToContentTypes?: string[] | '*';
  filter?: (entity: Entity) => boolean;
  permission?: BasicPermission;
  variant?: 'button' | 'menu-item';
  priority?: number;
}
