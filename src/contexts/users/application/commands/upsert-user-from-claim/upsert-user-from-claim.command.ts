import { EmailValueObject } from '@sisques-labs/nestjs-kit';
import { UserPrimitives } from '@contexts/users/domain/primitives/user.primitives';
import { UserExternalIdValueObject } from '@contexts/users/domain/value-objects/user-external-id/user-external-id.vo';
import { UserTenantIdValueObject } from '@contexts/users/domain/value-objects/user-tenant-id/user-tenant-id.vo';

/**
 * Primitive input the caller (`UsersController`, in a later layer)
 * supplies. Derived from `UserPrimitives` via `Pick` instead of
 * hand-declared, so this stays in sync with the aggregate's actual field
 * set automatically. Excludes `displayName` — this command never sets it;
 * see `UpdateUserDisplayNameCommand` for that.
 */
export type UpsertUserFromClaimCommandInput = Pick<
  UserPrimitives,
  'tenantId' | 'externalId' | 'email'
>;

/**
 * Finds or creates a `User` for the given tenant-scoped `(tenantId,
 * externalId)` pair, re-syncing `email` from the verified token on every
 * call. Returns the resulting `UserViewModel` — unlike most command
 * handlers in this codebase, both `/users/me` verbs need the full current
 * profile, not just an id (see `openspec/changes/add-users-context/design.md`).
 */
export class UpsertUserFromClaimCommand {
  readonly tenantId: UserTenantIdValueObject;
  readonly externalId: UserExternalIdValueObject;
  readonly email: EmailValueObject | null;

  constructor(input: UpsertUserFromClaimCommandInput) {
    this.tenantId = new UserTenantIdValueObject(input.tenantId);
    this.externalId = new UserExternalIdValueObject(input.externalId);
    this.email = input.email ? new EmailValueObject(input.email) : null;
  }
}
