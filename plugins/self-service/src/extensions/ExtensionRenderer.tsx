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
} from '@ansible/backstage-rhaap-extension-api';

const Fallback = () => (
  <CircularProgress
    size={24}
    style={{ display: 'block', margin: '16px auto' }}
  />
);

/** Renders a tab contribution's component inside `<Suspense>`.
 *  Returns null while loading or if the user lacks the required permission. */
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
    <Suspense fallback={<Fallback />}>
      <Component entity={entity} />
    </Suspense>
  );
};

/** Renders a card contribution's component inside `<Suspense>`.
 *  Returns null while loading or if the user lacks the required permission. */
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
    <Suspense fallback={<Fallback />}>
      <Component entity={entity} />
    </Suspense>
  );
};

/** Builds an action handler wrapper that:
 *  1. Evaluates the `permission` gate.
 *  2. Injects `getApi` via `useApiHolder()` into the handler's `ActionContext`.
 *
 *  Must be called inside a React component (uses hooks). */
export const useActionHandler = (
  contribution: ActionContribution,
  entity: Entity,
) => {
  const apiHolder = useApiHolder();
  const { allowed } = usePermission({
    permission: contribution.permission ?? null!,
  });

  if (contribution.permission && !allowed) return null;

  return () =>
    contribution.handler({
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
  const handler = useActionHandler(contribution, entity);
  if (!handler) return null;

  const Icon = contribution.icon;
  return (
    <MenuItem
      onClick={() => {
        Promise.resolve(handler()).catch(err =>
          // eslint-disable-next-line no-console
          console.error('[ExtensionAction] handler threw:', err),
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
