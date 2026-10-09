import type { Entity } from '@backstage/catalog-model';
import { stringifyEntityRef } from '@backstage/catalog-model';
import type {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';

/** Catalog persists the provider bucket; delta mutations never wipe unrelated registrations. */
export class ManualGitRepositoryProvider implements EntityProvider {
  private connection?: EntityProviderConnection;
  private readonly stopped = new Set<string>();

  getProviderName(): string {
    return 'ManualGitRepositoryProvider';
  }
  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
  }

  isTrackingStopped(entity: Entity): boolean {
    return this.stopped.has(stringifyEntityRef(entity));
  }

  private validate(entity: Entity): EntityProviderConnection {
    if (!this.connection)
      throw new Error('Manual repository provider is not connected');
    if (
      entity.kind.toLowerCase() !== 'component' ||
      entity.spec?.type !== 'git-repository' ||
      entity.metadata.annotations?.['ansible.io/registration-method'] !==
        'manual'
    ) {
      throw new Error(
        'Only manually registered Git repositories are supported',
      );
    }
    return this.connection;
  }

  async registerRepository(entity: Entity): Promise<void> {
    await this.validate(entity).applyMutation({
      type: 'delta',
      added: [{ entity, locationKey: this.getProviderName() }],
      removed: [],
    });
    this.stopped.delete(stringifyEntityRef(entity));
  }

  async deregisterRepository(entity: Entity): Promise<void> {
    const connection = this.validate(entity);
    const ref = stringifyEntityRef(entity);
    const wasStopped = this.stopped.has(ref);
    this.stopped.add(ref);
    try {
      await connection.applyMutation({
        type: 'delta',
        added: [],
        removed: [{ entity, locationKey: this.getProviderName() }],
      });
    } catch (error) {
      if (!wasStopped) this.stopped.delete(ref);
      throw error;
    }
  }
}
