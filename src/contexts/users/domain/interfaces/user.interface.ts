import { DateValueObject, EmailValueObject } from '@sisques-labs/nestjs-kit';
import { UserDisplayNameValueObject } from '@contexts/users/domain/value-objects/user-display-name/user-display-name.vo';
import { UserExternalIdValueObject } from '@contexts/users/domain/value-objects/user-external-id/user-external-id.vo';
import { UserIdValueObject } from '@contexts/users/domain/value-objects/user-id/user-id.vo';
import { UserTenantIdValueObject } from '@contexts/users/domain/value-objects/user-tenant-id/user-tenant-id.vo';

/**
 * Value-object shape of a `User` aggregate's fields — what
 * `UserAggregate`'s constructor hydrates from (see `UserBuilder.build()`,
 * the only place that wraps primitives into these value objects). `email`
 * is nullable rather than a nullable value object — there is no invalid
 * non-empty state to guard against once it's `null`, so there is nothing
 * for a wrapper to validate in that case.
 */
export interface IUser {
  id: UserIdValueObject;
  tenantId: UserTenantIdValueObject;
  externalId: UserExternalIdValueObject;
  email: EmailValueObject | null;
  displayName: UserDisplayNameValueObject;
  createdAt: DateValueObject;
  updatedAt: DateValueObject;
}
