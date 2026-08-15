/**
 * Provider-agnostic role set. Each identity provider adapter maps its own
 * raw claim shape (Cognito `cognito:groups`, Supabase `app_metadata.roles`,
 * a configurable OIDC claim) onto these values — nothing downstream of
 * `IIdentityProvider.verifyToken()` ever sees a provider-specific role name.
 */
export enum Role {
  ADMIN = 'admin',
  USER = 'user',
}
