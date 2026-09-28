import {
  createServiceFactory,
  createServiceRef,
} from '@backstage/backend-plugin-api';

/**
 * Interface for JIT user provisioning into the Backstage catalog.
 * @public
 */
export interface IUserProvisioner {
  /**
   * Creates a catalog User entity for the given AAP user.
   * Called by the auth resolver on first login.
   */
  createUser(username: string, userID: number): Promise<boolean>;
}

/**
 * Internal class holding the registered creator function.
 * Shared as a root-scoped singleton so catalog and auth modules share the same instance.
 * @public
 */
export class UserProvisioner implements IUserProvisioner {
  private createUserFn:
    | ((username: string, userID: number) => Promise<boolean>)
    | null = null;

  /**
   * Called by the catalog module to register the actual user creation implementation.
   * Must be called before any createUser() call (i.e. before first login).
   */
  registerCreateUserFn(
    fn: (username: string, userID: number) => Promise<boolean>,
  ): void {
    this.createUserFn = fn;
  }

  async createUser(username: string, userID: number): Promise<boolean> {
    if (!this.createUserFn) {
      throw new Error(
        `UserProvisioner: no create user function registered for "${username}". ` +
          'Install catalog-backend-module-rhaap-user-provisioner to enable JIT user provisioning.',
      );
    }
    return this.createUserFn(username, userID);
  }
}

/**
 * Root-scoped service ref for JIT user provisioning.
 * Provide an implementation by installing catalog-backend-module-rhaap-user-provisioner.
 * @public
 */
export const userProvisionerRef = createServiceRef<IUserProvisioner>({
  id: 'rhaap.user-provisioner',
  scope: 'root',
  defaultFactory: async service =>
    createServiceFactory({
      service,
      deps: {},
      factory: () => new UserProvisioner(),
    }),
});
