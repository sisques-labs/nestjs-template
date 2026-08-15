import {
  BaseAggregate,
  DateValueObject,
  UuidValueObject,
} from '@sisques-labs/nestjs-kit';
import { TenantCreatedEvent } from '@contexts/tenant/domain/events/tenant-created/tenant-created.event';
import { TenantPrimitives } from '@contexts/tenant/domain/primitives/tenant.primitives';
import { TenantExternalIdValueObject } from '@contexts/tenant/domain/value-objects/tenant-external-id/tenant-external-id.vo';

/**
 * `Tenant` — this template's first bounded-context aggregate. Deliberately
 * minimal: an internal `id` and the IdP-supplied `externalId` claim, no
 * `status` field or other data (see `add-tenant-context` proposal).
 */
export class TenantAggregate extends BaseAggregate {
  private readonly _id: UuidValueObject;
  private readonly _externalId: TenantExternalIdValueObject;

  /**
   * Hydration only — never emits domain events. Use `TenantBuilder` to
   * construct an instance, then call `create()` explicitly when the
   * aggregate represents a genuinely new `Tenant`.
   */
  constructor(primitives: TenantPrimitives) {
    super(
      new DateValueObject(primitives.createdAt),
      new DateValueObject(primitives.updatedAt),
    );
    this._id = new UuidValueObject(primitives.id);
    this._externalId = new TenantExternalIdValueObject(primitives.externalId);
  }

  get id(): UuidValueObject {
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
    this.apply(new TenantCreatedEvent(this.toPrimitives()));
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
