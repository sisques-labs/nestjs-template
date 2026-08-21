import { UuidValueObject } from '@sisques-labs/nestjs-kit';

/**
 * The `Tenant` aggregate's own internal identifier — a UUID assigned when a
 * `Tenant` row is first created (see `UpsertTenantFromClaimHandler`/
 * `FindOrCreateTenantByExternalIdService`). A concrete subclass of
 * `UuidValueObject` so `TenantAggregate`/`ITenant`/`TenantBuilder` carry
 * `Tenant`-specific typing for this field instead of a bare
 * `UuidValueObject` that could be confused with any other aggregate's id.
 */
export class TenantIdValueObject extends UuidValueObject {
  constructor(value?: string) {
    super(value);
  }
}
