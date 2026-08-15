import { TenantPrimitives } from '@contexts/tenant/domain/primitives/tenant.primitives';

/**
 * Emitted exclusively by `TenantAggregate.create()`, the first (and only,
 * in v1) time a `Tenant` row is created for a given `externalId`.
 */
export class TenantCreatedEvent {
  constructor(public readonly data: TenantPrimitives) {}
}
