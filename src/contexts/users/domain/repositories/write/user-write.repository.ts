import { IBaseWriteRepository } from '@sisques-labs/nestjs-kit';
import { UserAggregate } from '@contexts/users/domain/aggregates/user.aggregate';
import { UserExternalIdValueObject } from '@contexts/users/domain/value-objects/user-external-id/user-external-id.vo';
import { UserTenantIdValueObject } from '@contexts/users/domain/value-objects/user-tenant-id/user-tenant-id.vo';

/**
 * Write-side port for `User`. Implemented by
 * `infrastructure/persistence/typeorm/repositories/user-typeorm-write.repository.ts`.
 */
export interface IUserWriteRepository extends IBaseWriteRepository<UserAggregate> {
  /**
   * Looks up a `User` by its `(tenantId, externalId)` pair — uniqueness is
   * scoped per tenant, not global (see `user-profile` spec). Used by
   * `FindOrCreateUserByExternalIdService` to find-or-create a `User` the
   * first time a given principal is seen within a given tenant.
   */
  findByExternalId(
    tenantId: UserTenantIdValueObject,
    externalId: UserExternalIdValueObject,
  ): Promise<UserAggregate | null>;
}

/** DI token for `IUserWriteRepository`. */
export const USER_WRITE_REPOSITORY = Symbol('USER_WRITE_REPOSITORY');
