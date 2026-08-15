import { UuidValueObject } from '@sisques-labs/nestjs-kit';
import { TenantExternalIdValueObject } from '@contexts/tenant/domain/value-objects/tenant-external-id/tenant-external-id.vo';

/**
 * Value-object shape of a `Tenant` aggregate's fields. No `status` field and
 * no other fields — nothing in this bounded context would ever set one (see
 * `add-tenant-context` proposal, "Out of scope").
 */
export interface ITenant {
  id: UuidValueObject;
  externalId: TenantExternalIdValueObject;
}
