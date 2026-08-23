import { UuidValueObject } from '@sisques-labs/nestjs-kit';

/**
 * A `User`'s reference to the `Tenant` it belongs to — the internal
 * `Tenant.id`, not the IdP-supplied external tenant claim (`TenantGuard`
 * has already resolved that by the time it reaches this context). A
 * concrete subclass of `UuidValueObject` rather than an import of
 * `tenant`'s own `TenantIdValueObject` — the `users` context may only
 * import its own `@contexts/users/`; referencing another aggregate by id
 * uses a local type, per the cross-context boundary rule in
 * `openspec/config.yaml`.
 */
export class UserTenantIdValueObject extends UuidValueObject {
  constructor(value?: string) {
    super(value);
  }
}
