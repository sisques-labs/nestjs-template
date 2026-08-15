import { TenantExternalIdValueObject } from '@contexts/tenant/domain/value-objects/tenant-external-id/tenant-external-id.vo';

/** Primitive input the caller (`TenantGuard`, in a later layer) supplies. */
export interface UpsertTenantFromClaimCommandInput {
  externalId: string;
}

/**
 * Finds or creates a `Tenant` for the IdP-supplied `externalId` claim.
 * Deliberately the only command in this bounded context (see
 * `add-tenant-context` design) — `UpsertTenantFromClaimHandler` returns the
 * resolved internal `Tenant.id` synchronously so the caller can seed
 * request-scoped tenant context without a second round trip.
 */
export class UpsertTenantFromClaimCommand {
  readonly externalId: TenantExternalIdValueObject;

  constructor(input: UpsertTenantFromClaimCommandInput) {
    this.externalId = new TenantExternalIdValueObject(input.externalId);
  }
}
