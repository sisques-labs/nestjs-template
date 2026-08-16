import { BaseAggregate } from '@sisques-labs/nestjs-kit';
import { TenantCreatedEvent } from '@contexts/tenant/domain/events/tenant-created/tenant-created.event';
import { ITenant } from '@contexts/tenant/domain/interfaces/tenant.interface';
import { TenantPrimitives } from '@contexts/tenant/domain/primitives/tenant.primitives';
import { TenantExternalIdValueObject } from '@contexts/tenant/domain/value-objects/tenant-external-id/tenant-external-id.vo';
import { TenantIdValueObject } from '@contexts/tenant/domain/value-objects/tenant-id/tenant-id.vo';

/**
 * `Tenant` — this template's first bounded-context aggregate. Deliberately
 * minimal: an internal `id` and the IdP-supplied `externalId` claim, no
 * `status` field or other data (see `add-tenant-context` proposal).
 */
export class TenantAggregate extends BaseAggregate {
  private readonly _id: TenantIdValueObject;
  private readonly _externalId: TenantExternalIdValueObject;

  /**
   * Hydration only — never emits domain events. Takes an already-VO-wrapped
   * `ITenant` and just assigns it; primitive→VO conversion happens in
   * `TenantBuilder.build()`, not here. Use `TenantBuilder` to construct an
   * instance, then call `create()` explicitly when the aggregate represents
   * a genuinely new `Tenant`.
   */
  constructor(tenant: ITenant) {
    super(tenant.createdAt, tenant.updatedAt);
    this._id = tenant.id;
    this._externalId = tenant.externalId;
  }

  get id(): TenantIdValueObject {
    return this._id;
  }

  get externalId(): TenantExternalIdValueObject {
    return this._externalId;
  }

  /**
   * The only place that emits `TenantCreatedEvent`. Called once, right
   * after building a brand-new `Tenant` via `TenantBuilder` — never from
   * the constructor.
   */
  create(): void {
    this.apply(
      new TenantCreatedEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: TenantAggregate.name,
          entityId: this._id.value,
          entityType: TenantAggregate.name,
          eventType: TenantCreatedEvent.name,
        },
        this.toPrimitives(),
      ),
    );
  }

  toPrimitives(): TenantPrimitives {
    return {
      id: this._id.value,
      externalId: this._externalId.value,
      createdAt: this.createdAt.value,
      updatedAt: this.updatedAt.value,
    };
  }
}
