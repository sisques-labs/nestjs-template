import { BaseViewModel } from '@sisques-labs/nestjs-kit';

/**
 * Read-side projection of a `Tenant`, returned by `ITenantReadRepository`.
 */
export class TenantViewModel extends BaseViewModel {
  private readonly _externalId: string;

  constructor(
    id: string,
    externalId: string,
    createdAt: Date,
    updatedAt: Date,
  ) {
    super(id, createdAt, updatedAt);
    this._externalId = externalId;
  }

  get externalId(): string {
    return this._externalId;
  }
}
