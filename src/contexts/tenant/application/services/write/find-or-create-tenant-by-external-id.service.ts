import { Inject, Injectable } from '@nestjs/common';
import { IBaseService, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { TenantAggregate } from '@contexts/tenant/domain/aggregates/tenant.aggregate';
import { TenantBuilder } from '@contexts/tenant/domain/builders/tenant.builder';
import {
  ITenantWriteRepository,
  TENANT_WRITE_REPOSITORY,
} from '@contexts/tenant/domain/repositories/write/tenant-write.repository';
import { TenantExternalIdValueObject } from '@contexts/tenant/domain/value-objects/tenant-external-id/tenant-external-id.vo';

/**
 * Find-or-create by `externalId`. No write when a `Tenant` already exists
 * for it — the unique index on `tenants.external_id` is the primary
 * defense against duplicates (see `add-tenant-context` design), this
 * lookup just avoids an unnecessary insert attempt on the common path
 * (every request after a tenant's first).
 *
 * Returns the resulting `TenantAggregate` (not just its id) so the caller
 * gets a clean, reusable, aggregate-typed result — including a freshly
 * created aggregate's uncommitted `TenantCreatedEvent`, which the caller
 * (`UpsertTenantFromClaimHandler`) is responsible for publishing. Per this
 * codebase's logging convention, assert/lookup services like this one do
 * not log — that stays with the command handler.
 */
@Injectable()
export class FindOrCreateTenantByExternalIdService implements IBaseService<
  TenantExternalIdValueObject,
  TenantAggregate
> {
  constructor(
    @Inject(TENANT_WRITE_REPOSITORY)
    private readonly tenantWriteRepository: ITenantWriteRepository,
  ) {}

  async execute(
    externalId: TenantExternalIdValueObject,
  ): Promise<TenantAggregate> {
    const existing =
      await this.tenantWriteRepository.findByExternalId(externalId);

    if (existing) {
      return existing;
    }

    const tenant = new TenantBuilder()
      .withId(UuidValueObject.generate().value)
      .withExternalId(externalId.value)
      .withCreatedAt(new Date())
      .withUpdatedAt(new Date())
      .build();

    tenant.create();

    return this.tenantWriteRepository.save(tenant);
  }
}
