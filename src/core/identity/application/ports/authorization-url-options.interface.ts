/**
 * Options passed to `IIdentityProvider.getAuthorizationUrl()` to build the
 * redirect URL for `GET /auth/oauth/start`. `codeChallenge` is the PKCE
 * `S256` challenge derived from a server-side `code_verifier` — the
 * matching `code_verifier` never leaves the backend.
 */
export interface IAuthorizationUrlOptions {
  redirectUri: string;
  state: string;
  codeChallenge: string;
}
