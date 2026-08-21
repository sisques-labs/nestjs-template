import { BaseViewModel } from '@sisques-labs/nestjs-kit';
import { TenantPrimitives } from '@contexts/tenant/domain/primitives/tenant.primitives';

/**
 * Read-side projection of a `Tenant`, returned by `ITenantReadRepository`.
 * Constructed from a single `TenantPrimitives` params object — the
 * established serialized shape for this aggregate — rather than positional
 * arguments.
 */
export class TenantViewModel extends BaseViewModel {
  private readonly _externalId: string;

  constructor(primitives: TenantPrimitives) {
    super(primitives.id, primitives.createdAt, primitives.updatedAt);
    this._externalId = primitives.externalId;
  }

  get externalId(): string {
    return this._externalId;
  }
}
