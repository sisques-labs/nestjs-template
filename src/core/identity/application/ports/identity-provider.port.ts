import { IAuthorizationCodeExchange } from './interfaces/authorization-code-exchange.interface';
import { IAuthorizationUrlOptions } from './interfaces/authorization-url-options.interface';
import { ILoginCredentials } from './interfaces/login-credentials.interface';
import { IPrincipal } from './interfaces/principal.interface';
import { ITokenSet } from './interfaces/token-set.interface';
import { IUserAttributes } from './interfaces/user-attributes.interface';

/**
 * DI token for the active `IIdentityProvider` adapter, bound by
 * `identity-provider.factory.ts` from `IDENTITY_PROVIDER`.
 */
export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');

/**
 * Bridge to an external identity provider (Cognito, Supabase, generic
 * OIDC, ...). No implementation persists a local copy of the user — the
 * provider is always the source of truth.
 */
export interface IIdentityProvider {
  login(credentials: ILoginCredentials): Promise<ITokenSet>;
  refreshToken(refreshToken: string): Promise<ITokenSet>;
  verifyToken(accessToken: string): Promise<IPrincipal>;
  createUser(attributes: IUserAttributes): Promise<string>;
  disableUser(userId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  updateUserAttributes(
    userId: string,
    attributes: Partial<IUserAttributes>,
  ): Promise<void>;
  resetPassword(userId: string): Promise<void>;

  /**
   * Builds the redirect URL for `GET /auth/oauth/start` — the provider's
   * authorization endpoint (Cognito Hosted UI, Supabase `signInWithOAuth`,
   * or the OIDC issuer's `/authorize`), carrying `state` and the PKCE
   * `code_challenge`.
   */
  getAuthorizationUrl(options: IAuthorizationUrlOptions): Promise<string>;

  /**
   * Exchanges the authorization `code` returned to `GET /auth/oauth/callback`
   * for a token set, verifying the PKCE `code_verifier` against the
   * `code_challenge` sent in `getAuthorizationUrl()`.
   */
  exchangeAuthorizationCode(
    options: IAuthorizationCodeExchange,
  ): Promise<ITokenSet>;
}
