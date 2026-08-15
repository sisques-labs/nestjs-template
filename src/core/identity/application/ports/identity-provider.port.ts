import { ILoginCredentials } from './login-credentials.interface';
import { IPrincipal } from './principal.interface';
import { ITokenSet } from './token-set.interface';
import { IUserAttributes } from './user-attributes.interface';

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
}
