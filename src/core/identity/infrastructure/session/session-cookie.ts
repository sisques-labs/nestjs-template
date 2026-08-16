import { CookieOptions } from 'express';

/**
 * Shared attributes for every cookie this module sets — session cookie and
 * the short-lived `oauth_nonce` cookie alike. `SameSite=Lax` (not `Strict`)
 * so the cookie still rides along on the IdP's top-level-GET redirect back
 * to `GET /auth/oauth/callback`, while still blocking cross-site POSTs.
 */
const BASE_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
};

/**
 * Builds the `res.cookie(name, value, options)` arguments for the opaque
 * session-id cookie. The cookie only ever carries the session id — never
 * the provider's tokens.
 */
export function buildSessionCookie(
  sessionId: string,
  cookieName: string,
  ttlSeconds: number,
): { name: string; value: string; options: CookieOptions } {
  return {
    name: cookieName,
    value: sessionId,
    options: {
      ...BASE_COOKIE_OPTIONS,
      maxAge: ttlSeconds * 1000,
    },
  };
}

/**
 * Builds the `res.clearCookie(name, options)` arguments for logout.
 * `clearCookie` only actually clears the cookie in the browser when the
 * attributes match the ones it was set with (`path`/`httpOnly`/`secure`/
 * `sameSite`) — `maxAge`/`expires` are omitted, matching Express's own
 * `clearCookie` convention of expiring immediately.
 */
export function clearSessionCookieOptions(cookieName: string): {
  name: string;
  options: CookieOptions;
} {
  return {
    name: cookieName,
    options: { ...BASE_COOKIE_OPTIONS },
  };
}
