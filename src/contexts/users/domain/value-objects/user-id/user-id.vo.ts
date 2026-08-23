import { UuidValueObject } from '@sisques-labs/nestjs-kit';

/**
 * The `User` aggregate's own internal identifier — a UUID assigned when a
 * `User` row is first created (see `UpsertUserFromClaimHandler`/
 * `FindOrCreateUserByExternalIdService`). A concrete subclass of
 * `UuidValueObject` so `UserAggregate`/`IUser`/`UserBuilder` carry
 * `User`-specific typing for this field instead of a bare `UuidValueObject`
 * that could be confused with any other aggregate's id.
 */
export class UserIdValueObject extends UuidValueObject {
  constructor(value?: string) {
    super(value);
  }
}
