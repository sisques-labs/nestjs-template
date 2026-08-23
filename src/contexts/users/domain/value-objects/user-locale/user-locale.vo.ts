import { StringValueObject } from '@sisques-labs/nestjs-kit';

/**
 * A BCP-47-ish locale tag (`"en"`, `"en-US"`, `"pt-BR"`, ...). A local
 * subclass rather than `@sisques-labs/nestjs-kit`'s `LocaleValueObject`
 * deliberately: as of kit v1.6.1, that class lowercases its input via
 * `normalizeLocale()` *before* checking it against a pattern that requires
 * an uppercase region subtag (`/^[a-z]{2}(-[A-Z]{2})?$/`) — so
 * `new LocaleValueObject('en-US')` always throws
 * `String does not match required pattern`, for every region-qualified
 * locale, regardless of the `validateExistence` option. Verified directly
 * against the installed package before writing this class. `email`/
 * `avatarUrl`/`timezone` on this aggregate reuse the kit's value objects
 * as-is because they don't have this problem — see each field's own
 * rationale.
 *
 * Kept intentionally lenient (non-empty, reasonable length, a loose
 * language[-region] shape) rather than re-implementing strict BCP-47
 * parsing here — `UpdateUserProfileDto`'s `@IsLocale()` (class-validator,
 * backed by `Intl`) is the stricter check at the transport boundary; this
 * is the domain-layer safety net behind it.
 */
export class UserLocaleValueObject extends StringValueObject {
  private static readonly PATTERN = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

  constructor(value: string) {
    super(value, {
      allowEmpty: false,
      trim: true,
      maxLength: 35,
      pattern: UserLocaleValueObject.PATTERN,
    });
  }
}
