import { IBaseWriteRepository } from '@sisques-labs/nestjs-kit';
import { TenantAggregate } from '@contexts/tenant/domain/aggregates/tenant.aggregate';
import { TenantExternalIdValueObject } from '@contexts/tenant/domain/value-objects/tenant-external-id/tenant-external-id.vo';

/**
 * Write-side port for `Tenant`. Implemented by
 * `infrastructure/persistence/typeorm/repositories/tenant-typeorm-write.repository.ts`.
 */
export interface ITenantWriteRepository extends IBaseWriteRepository<TenantAggregate> {
  /**
   * Looks up a `Tenant` by its IdP-supplied `externalId` claim. Used by the
   * `upsert-tenant-from-claim` command handler to find-or-create a `Tenant`
   * the first time a given `externalId` is seen.
   */
  findByExternalId(
    externalId: TenantExternalIdValueObject,
  ): Promise<TenantAggregate | null>;
}

/** DI token for `ITenantWriteRepository`. */
export const TENANT_WRITE_REPOSITORY = Symbol('TENANT_WRITE_REPOSITORY');
