/**
 * Options passed to `IIdentityProvider.exchangeAuthorizationCode()` when
 * handling `GET /auth/oauth/callback` — the authorization `code` returned
 * by the provider plus the PKCE `code_verifier` matching the
 * `code_challenge` sent in `getAuthorizationUrl()`.
 */
export interface IAuthorizationCodeExchange {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}
