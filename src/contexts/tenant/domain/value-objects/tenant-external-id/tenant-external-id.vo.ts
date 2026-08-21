import { StringValueObject } from '@sisques-labs/nestjs-kit';

/**
 * The IdP-supplied `tenant_id` claim (a Cognito custom attribute, Supabase
 * `app_metadata.tenant_id`, or a generic OIDC claim) that identifies which
 * tenant a `Tenant` row was lazily created for. Must be a non-empty string.
 */
export class TenantExternalIdValueObject extends StringValueObject {
  constructor(value: string) {
    super(value, { allowEmpty: false, trim: true });
  }
}
