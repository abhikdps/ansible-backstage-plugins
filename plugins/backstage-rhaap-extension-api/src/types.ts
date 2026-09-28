import type { LazyExoticComponent, ComponentType } from 'react';
import type { Entity } from '@backstage/catalog-model';
import type { ApiRef } from '@backstage/core-plugin-api';
import type { BasicPermission } from '@backstage/plugin-permission-common';

/** A React component that may be lazy-loaded or synchronous.
 *  `ExtensionRenderer` always wraps in `<Suspense>` — the fallback
 *  never activates for synchronous components. */
export type ContributionComponent =
  | LazyExoticComponent<ComponentType<any>>
  | ComponentType<any>;

/** Context passed to an `ActionContribution.handler` at invocation time. */
export interface ActionContext {
  entity: Entity;
  /**
   * Resolves a Backstage API by ref. Equivalent to `useApi()` but callable
   * outside a React component. Built by `ExtensionRenderer` via
   * `useApiHolder()` at render time.
   *
   * @example
   * handler: ({ entity, getApi }) => {
   *   const catalogApi = getApi(catalogApiRef);  // import from @backstage/plugin-catalog-react
   *   await catalogApi.refreshEntity(entity.metadata.name);
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
   * Entity-based visibility filter. Called inside a `try/catch` — a throwing
   * filter is treated as "don't show" and logs a warning.
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
  filter?: (entity: Entity) => boolean;
  permission?: BasicPermission;
  priority?: number;
}

export interface ActionContribution {
  id: string;
  label: string;
  icon?: ComponentType;
  handler: (context: ActionContext) => void | Promise<void>;
  filter?: (entity: Entity) => boolean;
  permission?: BasicPermission;
  variant?: 'button' | 'menu-item';
  priority?: number;
}
