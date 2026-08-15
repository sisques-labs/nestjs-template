/**
 * Property key `IdentityGuard` attaches the resolved `IPrincipal` under on
 * the request object. Shared by `RolesGuard` and `@CurrentUser()` so both
 * read from the same place `IdentityGuard` writes to.
 */
export const REQUEST_PRINCIPAL_KEY = 'principal';
