import type { Entity } from '@backstage/catalog-model';
import type {
  TabContribution,
  CardContribution,
  ActionContribution,
} from './types';

type RegistryListener = () => void;

type ContributionMap<T> = Map<string, Map<string, T>>;

/**
 * Returns true when the contribution's `appliesToContentTypes` allows the
 * given content type. Contributions with no `appliesToContentTypes` field (or
 * `'*'`) are always shown. If no `contentType` is passed by the caller, the
 * check is skipped and all contributions are returned.
 */
function matchesContentType<
  T extends { appliesToContentTypes?: string[] | '*' },
>(contribution: T, contentType: string | undefined): boolean {
  if (!contentType) return true;
  const allowed = contribution.appliesToContentTypes;
  if (!allowed || allowed === '*') return true;
  return (allowed as string[]).includes(contentType);
}

function safeFilter<
  T extends {
    filter?: (e: Entity) => boolean;
    appliesToContentTypes?: string[] | '*';
  },
>(
  contribution: T,
  entity: Entity | undefined,
  contentType: string | undefined,
): boolean {
  // Disabled contributions are always hidden.
  if ((contribution as any)._disabled) return false;
  // Primary static gate: content type.
  if (!matchesContentType(contribution, contentType)) return false;
  // Additional UI predicate: entity filter.
  if (!contribution.filter || !entity) return true;
  try {
    return contribution.filter(entity);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[ContributionRegistry] filter() threw for contribution "${(contribution as any).id}":`,
      err,
    );
    return false;
  }
}

function sortByPriority<T extends { id: string; priority?: number }>(
  items: T[],
): T[] {
  // Array.prototype.sort is stable in modern JS engines — equal priorities
  // preserve insertion order.
  return [...items].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}

class ContributionRegistry {
  private readonly tabs: ContributionMap<TabContribution> = new Map();
  private readonly cards: ContributionMap<CardContribution> = new Map();
  private readonly actions: ContributionMap<ActionContribution> = new Map();
  private readonly listeners: Set<RegistryListener> = new Set();

  // ── Subscription ──────────────────────────────────────────────────────────

  subscribe(listener: RegistryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach(l => l());
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private register<T extends { id: string }>(
    store: ContributionMap<T>,
    extensionPoint: string,
    contribution: T,
  ): () => void {
    if (!store.has(extensionPoint)) {
      store.set(extensionPoint, new Map());
    }
    const ep = store.get(extensionPoint)!;
    if (ep.has(contribution.id)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[ContributionRegistry] Duplicate id "${contribution.id}" at extension point "${extensionPoint}" — replacing previous registration.`,
      );
    }
    ep.set(contribution.id, contribution);
    this.notify();
    return () => {
      ep.delete(contribution.id);
      this.notify();
    };
  }

  private get<
    T extends {
      id: string;
      filter?: (e: Entity) => boolean;
      appliesToContentTypes?: string[] | '*';
    },
  >(
    store: ContributionMap<T>,
    extensionPoint: string,
    entity?: Entity,
    contentType?: string,
  ): T[] {
    const ep = store.get(extensionPoint);
    if (!ep) return [];
    const all = Array.from(ep.values());
    const filtered = all.filter(c => safeFilter(c, entity, contentType));
    return sortByPriority(filtered);
  }

  // ── Tab registration ──────────────────────────────────────────────────────

  registerTab(
    extensionPoint: string,
    contribution: TabContribution,
  ): () => void {
    return this.register(this.tabs, extensionPoint, contribution);
  }

  getTabs(
    extensionPoint: string,
    entity?: Entity,
    contentType?: string,
  ): TabContribution[] {
    return this.get(this.tabs, extensionPoint, entity, contentType);
  }

  // ── Card registration ─────────────────────────────────────────────────────

  registerCard(
    extensionPoint: string,
    contribution: CardContribution,
  ): () => void {
    return this.register(this.cards, extensionPoint, contribution);
  }

  getCards(
    extensionPoint: string,
    entity?: Entity,
    contentType?: string,
  ): CardContribution[] {
    return this.get(this.cards, extensionPoint, entity, contentType);
  }

  // ── Action registration ───────────────────────────────────────────────────

  registerAction(
    extensionPoint: string,
    contribution: ActionContribution,
  ): () => void {
    return this.register(this.actions, extensionPoint, contribution);
  }

  getActions(
    extensionPoint: string,
    entity?: Entity,
    contentType?: string,
  ): ActionContribution[] {
    return this.get(this.actions, extensionPoint, entity, contentType);
  }

  // ── Enable / disable ─────────────────────────────────────────────────────

  disable(contributionId: string): void {
    this._setEnabled(contributionId, false);
  }

  enable(contributionId: string): void {
    this._setEnabled(contributionId, true);
  }

  private _setEnabled(contributionId: string, enabled: boolean): void {
    let changed = false;
    for (const store of [this.tabs, this.cards, this.actions]) {
      for (const ep of store.values()) {
        const contribution = ep.get(contributionId) as any;
        if (contribution) {
          // Enabled state stored as a non-enumerable shadow property; the
          // filter function in safeFilter checks it via the _disabled flag.
          contribution._disabled = !enabled;
          changed = true;
        }
      }
    }
    if (changed) this.notify();
  }

  // ── Test utilities ────────────────────────────────────────────────────────

  /** Clears all registrations. Call in `afterEach` to prevent test leakage. */
  reset(): void {
    this.tabs.clear();
    this.cards.clear();
    this.actions.clear();
    this.listeners.clear();
  }
}

/** Module-level singleton — the shared bus between community plugins and the
 *  self-service host. Must be a shared module (not embedded per-plugin) in
 *  RHDH deployments. See §4.3 of the architecture doc. */
export const contributionRegistry = new ContributionRegistry();

export type { ContributionRegistry };
