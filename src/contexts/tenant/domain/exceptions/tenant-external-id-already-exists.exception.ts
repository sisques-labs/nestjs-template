import { BaseException } from '@sisques-labs/nestjs-kit';

/**
 * Thrown when something attempts to create a `Tenant` for an `externalId`
 * that already has a `Tenant` row. The unique index on `tenants.external_id`
 * is the primary defense (see `add-tenant-context` design); this exception
 * exists for callers (e.g. a repository or handler doing its own
 * pre-check) that want to fail with a named domain error instead of a raw
 * constraint-violation error.
 */
export class TenantExternalIdAlreadyExistsException extends BaseException {
  constructor(externalId: string) {
    super(`Tenant with externalId "${externalId}" already exists`);
  }
}
