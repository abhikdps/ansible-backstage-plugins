import { useReducer, useEffect, useMemo } from 'react';
import type { Entity } from '@backstage/catalog-model';
import { contributionRegistry } from '../registry';
import type {
  TabContribution,
  CardContribution,
  ActionContribution,
} from '../types';

function useRevision(): number {
  const [revision, forceUpdate] = useReducer((x: number) => x + 1, 0);
  useEffect(() => contributionRegistry.subscribe(forceUpdate), []);
  return revision;
}

/** Returns sorted, filtered tab contributions for the given extension point.
 *  Re-renders automatically when late-loading plugins register contributions. */
export function useExtensionTabs(
  extensionPoint: string,
  entity?: Entity,
): TabContribution[] {
  const revision = useRevision();
  return useMemo(
    () => contributionRegistry.getTabs(extensionPoint, entity),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extensionPoint, entity, revision],
  );
}

/** Returns sorted, filtered card contributions for the given extension point.
 *  Re-renders automatically when late-loading plugins register contributions. */
export function useExtensionCards(
  extensionPoint: string,
  entity?: Entity,
): CardContribution[] {
  const revision = useRevision();
  return useMemo(
    () => contributionRegistry.getCards(extensionPoint, entity),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extensionPoint, entity, revision],
  );
}

/** Returns sorted, filtered action contributions for the given extension point.
 *  Re-renders automatically when late-loading plugins register contributions. */
export function useExtensionActions(
  extensionPoint: string,
  entity?: Entity,
): ActionContribution[] {
  const revision = useRevision();
  return useMemo(
    () => contributionRegistry.getActions(extensionPoint, entity),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extensionPoint, entity, revision],
  );
}
