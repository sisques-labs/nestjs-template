import { BaseAggregate, EmailValueObject } from '@sisques-labs/nestjs-kit';
import { UserCreatedEvent } from '@contexts/users/domain/events/user-created/user-created.event';
import { IUser } from '@contexts/users/domain/interfaces/user.interface';
import { UserPrimitives } from '@contexts/users/domain/primitives/user.primitives';
import { UserDisplayNameValueObject } from '@contexts/users/domain/value-objects/user-display-name/user-display-name.vo';
import { UserExternalIdValueObject } from '@contexts/users/domain/value-objects/user-external-id/user-external-id.vo';
import { UserIdValueObject } from '@contexts/users/domain/value-objects/user-id/user-id.vo';
import { UserTenantIdValueObject } from '@contexts/users/domain/value-objects/user-tenant-id/user-tenant-id.vo';

/**
 * `User` — this template's second bounded-context aggregate. A tenant-scoped
 * profile lazily created from the verified principal, the same way `Tenant`
 * is (see `openspec/changes/add-users-context/`). `email` is IdP-derived
 * and re-synced on every upsert via `syncEmail()`; `displayName` is the
 * only field a caller can change, via `rename()`.
 */
export class UserAggregate extends BaseAggregate {
  private readonly _id: UserIdValueObject;
  private readonly _tenantId: UserTenantIdValueObject;
  private readonly _externalId: UserExternalIdValueObject;
  private _email: EmailValueObject | null;
  private _displayName: UserDisplayNameValueObject;

  /**
   * Hydration only — never emits domain events. Takes an already-VO-wrapped
   * `IUser` and just assigns it; primitive→VO conversion happens in
   * `UserBuilder.build()`, not here. Use `UserBuilder` to construct an
   * instance, then call `create()` explicitly when the aggregate represents
   * a genuinely new `User`.
   */
  constructor(user: IUser) {
    super(user.createdAt, user.updatedAt);
    this._id = user.id;
    this._tenantId = user.tenantId;
    this._externalId = user.externalId;
    this._email = user.email;
    this._displayName = user.displayName;
  }

  get id(): UserIdValueObject {
    return this._id;
  }

  get tenantId(): UserTenantIdValueObject {
    return this._tenantId;
  }

  get externalId(): UserExternalIdValueObject {
    return this._externalId;
  }

  get email(): EmailValueObject | null {
    return this._email;
  }

  get displayName(): UserDisplayNameValueObject {
    return this._displayName;
  }

  /**
   * The only place that emits `UserCreatedEvent`. Called once, right after
   * building a brand-new `User` via `UserBuilder` — never from the
   * constructor.
   */
  create(): void {
    this.apply(
      new UserCreatedEvent(
        {
          aggregateRootId: this._id.value,
          aggregateRootType: UserAggregate.name,
          entityId: this._id.value,
          entityType: UserAggregate.name,
          eventType: UserCreatedEvent.name,
        },
        this.toPrimitives(),
      ),
    );
  }

  /** Updates the user-owned `displayName`. Does not emit an event — see
   * the class doc comment. */
  rename(displayName: UserDisplayNameValueObject): void {
    this._displayName = displayName;
    this.touch();
  }

  /** Re-syncs `email` from the verified token. Called on every upsert,
   * including when the `User` row already exists — see `user-profile`
   * spec's email-resync requirement. Does not emit an event. */
  syncEmail(email: EmailValueObject | null): void {
    this._email = email;
    this.touch();
  }

  toPrimitives(): UserPrimitives {
    return {
      id: this._id.value,
      tenantId: this._tenantId.value,
      externalId: this._externalId.value,
      email: this._email?.value ?? null,
      displayName: this._displayName.value,
      createdAt: this.createdAt.value,
      updatedAt: this.updatedAt.value,
    };
  }
}
