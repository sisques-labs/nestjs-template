import { EmailValueObject, UrlValueObject } from '@sisques-labs/nestjs-kit';
import { UserPrimitives } from '@contexts/users/domain/primitives/user.primitives';
import { UserDisplayNameValueObject } from '@contexts/users/domain/value-objects/user-display-name/user-display-name.vo';
import { UserExternalIdValueObject } from '@contexts/users/domain/value-objects/user-external-id/user-external-id.vo';
import { UserTenantIdValueObject } from '@contexts/users/domain/value-objects/user-tenant-id/user-tenant-id.vo';

/**
 * See `UpsertUserFromClaimCommandInput` — same `Pick`-from-primitives
 * convention for the required fields, plus `displayName` this command
 * actually sets. `avatarUrl` is a genuinely optional key (not just an
 * optional-with-a-default one): omit it entirely to leave the stored
 * `avatarUrl` untouched, pass a URL string to set it, or pass `null` to
 * clear it. `displayName` has no such three-state distinction — it's
 * always required and always applied, matching `PATCH /users/me`'s DTO.
 */
export type UpdateUserProfileCommandInput = Pick<
  UserPrimitives,
  'tenantId' | 'externalId' | 'email' | 'displayName'
> & { avatarUrl?: string | null };

/**
 * Updates the caller's own `displayName` (always) and `avatarUrl` (only
 * when the caller's request included that key at all), creating the
 * `User` row first (via the same find-or-create path
 * `UpsertUserFromClaimCommand` uses) if it doesn't exist yet — a caller
 * can set their profile on their very first request, without a prior
 * `GET /users/me` having created the row. `tenantId`/`externalId`/`email`
 * here are the same verified-token-derived values every command in this
 * context takes — never client-writable through this command's own input.
 */
export class UpdateUserProfileCommand {
  readonly tenantId: UserTenantIdValueObject;
  readonly externalId: UserExternalIdValueObject;
  readonly email: EmailValueObject | null;
  readonly displayName: UserDisplayNameValueObject;
  /** `undefined` = key absent from the request, leave `avatarUrl`
   * untouched. `null` = clear it. A `UrlValueObject` = set it. */
  readonly avatarUrl: UrlValueObject | null | undefined;

  constructor(input: UpdateUserProfileCommandInput) {
    this.tenantId = new UserTenantIdValueObject(input.tenantId);
    this.externalId = new UserExternalIdValueObject(input.externalId);
    this.email = input.email ? new EmailValueObject(input.email) : null;
    this.displayName = new UserDisplayNameValueObject(input.displayName);
    this.avatarUrl =
      input.avatarUrl === undefined
        ? undefined
        : input.avatarUrl
          ? new UrlValueObject(input.avatarUrl)
          : null;
  }
}
