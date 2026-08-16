# Add OAuth/social login via a BFF session

## Why

`src/core/identity/` (added by `add-core-identity-module`) only supports
backend-proxied email+password login: `POST /auth/login` forwards
credentials to the active `IIdentityProvider` (Cognito/Supabase/OIDC) using
that provider's password-based grant, and returns the resulting
`accessToken`/`refreshToken` straight to the caller, which is expected to
hold them and send them back as `Authorization: Bearer <token>`.

That shape cannot support social login (Google, and anything else the
active provider federates in front of it — Cognito Hosted UI, Supabase's
OAuth providers, or an OIDC IdP like Auth0/Firebase with Google configured
upstream). Social login is inherently a browser-redirect flow: the user
leaves the app, authenticates at the provider's consent screen, and comes
back with an authorization `code` — there is no password to POST. Layering
that on top of the current design without changing anything about how
tokens are handed to the client would mean the frontend ends up holding a
third-party-issued `refreshToken` directly, which OAuth 2.1 explicitly
discourages for public clients (no client secret, no safe place to keep a
long-lived credential).

## What Changes

- Add a parallel, cookie-based login path following the **Backend For
  Frontend (BFF)** pattern, alongside the existing bearer-token path
  (unchanged, still supported for service-to-service/mobile clients):
  - **`GET /auth/oauth/start`** — generates PKCE (`code_verifier`/
    `code_challenge`) + a CSRF `state`, stashes them server-side keyed by a
    short-lived nonce, and 302-redirects the browser to the active
    provider's authorization endpoint.
  - **`GET /auth/oauth/callback`** — validates `state`, exchanges the
    returned `code` for a token set against the active provider, creates a
    server-side session (see below), sets a single `HttpOnly` + `Secure` +
    `SameSite=Lax` cookie carrying only an opaque session id, and redirects
    to `OAUTH_SUCCESS_REDIRECT_URL`.
  - **`POST /auth/logout`** — destroys the server-side session and expires
    the cookie.
- Extend the `IIdentityProvider` port with two new methods —
  `getAuthorizationUrl()` and `exchangeAuthorizationCode()` — implemented
  by all three existing adapters (Cognito via Hosted UI, Supabase via
  `signInWithOAuth`/`exchangeCodeForSession`, OIDC via
  `openid-client`'s authorization-code helpers). Same port-per-provider
  shape the module already uses for `login`/`refreshToken`/`verifyToken` —
  this is additive to that port, not a parallel abstraction.
- Add a new `ISessionStore` port + a Redis-backed adapter
  (`infrastructure/session/`) holding, per session id: the provider's
  current `accessToken`/`refreshToken`/`expiresAt` and the resolved
  `IPrincipal`, with a TTL. `IdentityGuard` is extended to resolve a
  principal from the session cookie as an alternative to the
  `Authorization` header — when the stored `accessToken` has expired, it
  transparently refreshes it against the provider using the stored
  `refreshToken` and updates the session, with no separate refresh
  endpoint needed for cookie-based sessions.
- New env vars, all gated behind a single `OAUTH_SESSION_ENABLED` flag
  (opt-in, mirrors the `TENANCY_ENABLED` -> `IDENTITY_PROVIDER` fail-fast
  dependency pattern): `SESSION_REDIS_URL`, `SESSION_COOKIE_NAME`,
  `SESSION_TTL_SECONDS`, `OAUTH_REDIRECT_URI`,
  `OAUTH_SUCCESS_REDIRECT_URL`, plus one new var per provider for the
  authorization endpoint it needs (`COGNITO_HOSTED_UI_DOMAIN` for Cognito;
  Supabase and OIDC reuse their existing config).
- New dependencies: `ioredis` (session store), `cookie-parser` (reading the
  session cookie).
- Update `src/core/identity/README.md` and root `README.md`'s Identity row
  to describe both login paths.

## Impact

- **Affected specs**: new capability `oauth-session-login` (added), see
  `specs/oauth-session-login/spec.md`.
- **Affected code**: `src/core/identity/**` (new OAuth/session pieces,
  `IIdentityProvider` port extended, all three adapters extended,
  `IdentityGuard` extended), `src/core/config/env.validation.ts` (new env
  vars), `src/main.ts` (`cookie-parser` middleware), `package.json` /
  lockfile, `.env.example`, `docker-compose.yml` (local Redis for dev),
  `README.md`.
- **Bounded contexts impacted**: none — entirely inside `src/core/`, same
  as `add-core-identity-module`.
- **Breaking changes**: none. `OAUTH_SESSION_ENABLED` defaults unset; the
  existing `POST /auth/login`/`POST /auth/refresh` bearer-token flow is
  untouched and keeps working exactly as it does today whether or not this
  change is enabled. `IdentityGuard`'s extended resolution order (cookie
  session first, then `Authorization` header) is additive — a request that
  carries a valid bearer token today keeps being accepted the same way.
- **Out of scope for this change** (tracked as follow-ups):
  - Per-tenant/multi-account "linking" (one user with both a
    password-based account and a Google-federated account merged into one
    `IPrincipal`) — this change treats an OAuth login as producing whatever
    principal the provider's token maps to, same as password login; account
    linking is provider-side (e.g. Supabase's own identity-linking) or a
    future change.
  - CSRF protection beyond the OAuth `state` parameter and
    `SameSite=Lax` (e.g. double-submit tokens for state-changing
    requests) — `SameSite=Lax` already blocks the classic cross-site
    cookie-riding case for this cookie; a broader CSRF strategy for the
    whole app is a separate concern.
  - "Logout everywhere" (invalidating every session for a user across
    devices) — v1 only destroys the one session tied to the cookie
    presented to `POST /auth/logout`.
  - A non-Redis session store option — `ISessionStore` is a port, so a
    second adapter is possible later, but only the Redis adapter ships
    here (see `design.md` for why Redis over Postgres).

## Rollback Plan

- Purely additive and gated behind `OAUTH_SESSION_ENABLED`: unsetting it
  restores current behavior exactly — no guard/controller from this change
  is registered, and the existing bearer-token flow is never touched by
  this change's code paths.
- If Redis becomes unavailable in production, `OAUTH_SESSION_ENABLED` can
  be unset to fall back to bearer-only auth without a code deploy — only an
  env config change, same rollback shape `add-core-identity-module`
  documented for `IDENTITY_PROVIDER`.
- Full revert = revert the commit(s) adding the OAuth/session pieces under
  `src/core/identity/`, the `IdentityGuard` extension, the `cookie-parser`
  wiring in `src/main.ts`, and the new dependencies. No data migration
  exists to unwind — sessions live in Redis with a TTL, not Postgres.
