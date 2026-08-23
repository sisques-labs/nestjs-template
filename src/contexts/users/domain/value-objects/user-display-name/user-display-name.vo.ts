import { StringValueObject } from '@sisques-labs/nestjs-kit';

/** Maximum length for a `User`'s `displayName` — generous enough for a
 * full name, short enough to keep UI layouts predictable. */
export const USER_DISPLAY_NAME_MAX_LENGTH = 100;

/**
 * The only user-editable field on `User` — never derived from the
 * verified token. Must be non-empty; defaults are computed by
 * `FindOrCreateUserByExternalIdService` on creation (see `user-profile`
 * spec's "displayName default" scenarios), not by this value object.
 */
export class UserDisplayNameValueObject extends StringValueObject {
  constructor(value: string) {
    super(value, {
      allowEmpty: false,
      trim: true,
      maxLength: USER_DISPLAY_NAME_MAX_LENGTH,
    });
  }
}
