import { Suspense, type ComponentType } from 'react';
import {
  CircularProgress,
  ListItemIcon,
  MenuItem,
  Typography,
} from '@material-ui/core';
import { useApiHolder } from '@backstage/core-plugin-api';
import { usePermission } from '@backstage/plugin-permission-react';
import type { Entity } from '@backstage/catalog-model';
import type {
  TabContribution,
  CardContribution,
  ActionContribution,
} from '@ansible/portal-extension-api';
import { ErrorBoundary } from './ErrorBoundary';
import { ContributionWrapper } from './ContributionWrapper';

const Fallback = () => (
  <CircularProgress
    size={24}
    style={{ display: 'block', margin: '16px auto' }}
  />
);

/** Renders a tab contribution's component inside `<Suspense>`.
 *  Returns null while loading or if the user lacks the required permission.
 *  Injects portal CSS custom properties (`--portal-color-*`) on a
 *  `display: contents` wrapper so contributed components can use them
 *  without importing MUI or Backstage theme utilities. */
export const ExtensionTabContent = ({
  contribution,
  entity,
}: {
  contribution: TabContribution;
  entity?: Entity;
}) => {
  const { allowed } = usePermission({
    permission: contribution.permission ?? null!,
  });

  if (contribution.permission && !allowed) return null;

  const Component = contribution.component as ComponentType<{
    entity?: Entity;
  }>;
  return (
    <ContributionWrapper>
      <ErrorBoundary contributionId={contribution.id}>
        <Suspense fallback={<Fallback />}>
          <Component entity={entity} />
        </Suspense>
      </ErrorBoundary>
    </ContributionWrapper>
  );
};

/** Renders a card contribution's component inside `<ErrorBoundary>` + `<Suspense>`.
 *  Returns null while loading or if the user lacks the required permission.
 *  Injects portal CSS custom properties (`--portal-color-*`) on a
 *  `display: contents` wrapper so contributed components can use them
 *  without importing MUI or Backstage theme utilities. */
export const ExtensionCardContent = ({
  contribution,
  entity,
}: {
  contribution: CardContribution;
  entity?: Entity;
}) => {
  const { allowed } = usePermission({
    permission: contribution.permission ?? null!,
  });

  if (contribution.permission && !allowed) return null;

  const Component = contribution.component as ComponentType<{
    entity?: Entity;
  }>;
  return (
    <ContributionWrapper>
      <ErrorBoundary contributionId={contribution.id}>
        <Suspense fallback={<Fallback />}>
          <Component entity={entity} />
        </Suspense>
      </ErrorBoundary>
    </ContributionWrapper>
  );
};

/**
 * Builds an action activation wrapper that:
 * 1. Evaluates the `permission` gate.
 * 2. Injects `getApi` via `useApiHolder()` into the `ActionContext`.
 *
 * Must be called inside a React component (uses hooks).
 *
 * Note: `onActivate` is for pure UI effects only (navigation, dialogs).
 * For server-side effects, the contribution should use `launches` instead.
 */
export const useActionActivation = (
  contribution: ActionContribution,
  entity: Entity,
) => {
  const apiHolder = useApiHolder();
  const { allowed } = usePermission({
    permission: contribution.permission ?? null!,
  });

  if (contribution.permission && !allowed) return null;

  return () =>
    contribution.onActivate?.({
      entity,
      getApi: apiRef => apiHolder.get(apiRef)!,
    });
};

/** Renders a single action contribution as a `<MenuItem>`.
 *  Handles permission gating and `getApi` injection internally.
 *  Returns null when the user lacks the required permission. */
export const ExtensionActionMenuItem = ({
  contribution,
  entity,
  onMenuClose,
}: {
  contribution: ActionContribution;
  entity: Entity;
  onMenuClose: () => void;
}) => {
  const activate = useActionActivation(contribution, entity);
  if (!activate) return null;

  const Icon = contribution.icon;
  return (
    <MenuItem
      onClick={() => {
        Promise.resolve(activate()).catch(err =>
          // eslint-disable-next-line no-console
          console.error('[ExtensionAction] onActivate threw:', err),
        );
        onMenuClose();
      }}
    >
      {Icon && (
        <ListItemIcon style={{ minWidth: 36 }}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Icon {...({ fontSize: 'small' } as any)} />
        </ListItemIcon>
      )}
      <Typography variant="body2">{contribution.label}</Typography>
    </MenuItem>
  );
};
