/**
 * Supported values for the `IDENTITY_PROVIDER` env var. The single source
 * of truth for which `IIdentityProvider` adapter `identityProviderFactory`
 * resolves — no bare string literals in the switch or in config validation.
 */
export enum IdentityProviderTypeEnum {
  COGNITO = 'cognito',
  SUPABASE = 'supabase',
  OIDC = 'oidc',
}
