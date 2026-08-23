import { EmailValueObject } from '@sisques-labs/nestjs-kit';
import { UserPrimitives } from '@contexts/users/domain/primitives/user.primitives';
import { UserDisplayNameValueObject } from '@contexts/users/domain/value-objects/user-display-name/user-display-name.vo';
import { UserExternalIdValueObject } from '@contexts/users/domain/value-objects/user-external-id/user-external-id.vo';
import { UserTenantIdValueObject } from '@contexts/users/domain/value-objects/user-tenant-id/user-tenant-id.vo';

/** See `UpsertUserFromClaimCommandInput` — same `Pick`-from-primitives
 * convention, plus the new `displayName` this command actually sets. */
export type UpdateUserDisplayNameCommandInput = Pick<
  UserPrimitives,
  'tenantId' | 'externalId' | 'email' | 'displayName'
>;

/**
 * Updates the caller's own `displayName`, creating the `User` row first
 * (via the same find-or-create path `UpsertUserFromClaimCommand` uses) if
 * it doesn't exist yet — a caller can set their display name on their very
 * first request, without a prior `GET /users/me` having created the row.
 * `tenantId`/`externalId`/`email` here are the same verified-token-derived
 * values every command in this context takes — never client-writable
 * through this command's own input.
 */
export class UpdateUserDisplayNameCommand {
  readonly tenantId: UserTenantIdValueObject;
  readonly externalId: UserExternalIdValueObject;
  readonly email: EmailValueObject | null;
  readonly displayName: UserDisplayNameValueObject;

  constructor(input: UpdateUserDisplayNameCommandInput) {
    this.tenantId = new UserTenantIdValueObject(input.tenantId);
    this.externalId = new UserExternalIdValueObject(input.externalId);
    this.email = input.email ? new EmailValueObject(input.email) : null;
    this.displayName = new UserDisplayNameValueObject(input.displayName);
  }
}
