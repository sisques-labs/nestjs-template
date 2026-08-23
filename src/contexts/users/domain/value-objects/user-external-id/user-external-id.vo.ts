import { StringValueObject } from '@sisques-labs/nestjs-kit';

/**
 * The IdP-supplied `sub` claim that identifies which principal a `User`
 * row was lazily created for, scoped within a tenant (see the
 * `(tenant_id, external_id)` uniqueness requirement in `user-profile`'s
 * spec). Must be a non-empty string.
 */
export class UserExternalIdValueObject extends StringValueObject {
  constructor(value: string) {
    super(value, { allowEmpty: false, trim: true });
  }
}
