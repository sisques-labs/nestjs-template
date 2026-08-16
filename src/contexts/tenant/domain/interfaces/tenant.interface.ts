import { DateValueObject } from '@sisques-labs/nestjs-kit';
import { TenantExternalIdValueObject } from '@contexts/tenant/domain/value-objects/tenant-external-id/tenant-external-id.vo';
import { TenantIdValueObject } from '@contexts/tenant/domain/value-objects/tenant-id/tenant-id.vo';

/**
 * Value-object shape of a `Tenant` aggregate's fields — what
 * `TenantAggregate`'s constructor hydrates from (see `TenantBuilder.build()`,
 * the only place that wraps primitives into these value objects). No
 * `status` field and no other fields — nothing in this bounded context
 * would ever set one (see `add-tenant-context` proposal, "Out of scope").
 */
export interface ITenant {
  id: TenantIdValueObject;
  externalId: TenantExternalIdValueObject;
  createdAt: DateValueObject;
  updatedAt: DateValueObject;
}
