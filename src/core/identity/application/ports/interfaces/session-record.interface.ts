import { IPrincipal } from './principal.interface';
import { ITokenSet } from './token-set.interface';

/**
 * Shape stored under `session:{sessionId}` in the `ISessionStore` for an
 * authenticated OAuth/BFF session — written by `OAuthController` on
 * callback, read (and rewritten on silent refresh) by `IdentityGuard`.
 * `expiresAt` is an absolute epoch-millisecond timestamp, derived once from
 * the provider's `expiresIn` duration so every subsequent read is a plain
 * comparison against `Date.now()`.
 */
export interface ISessionRecord {
  tokenSet: ITokenSet;
  principal: IPrincipal;
  expiresAt: number;
}
