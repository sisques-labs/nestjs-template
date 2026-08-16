# Tasks: add-identity-oauth-bff

No DB schema changes in this change — sessions and OAuth `state`/PKCE
entries live in the session store (Redis, or Postgres if the open question
in `design.md` resolves that way — if Postgres, task 1.1 additionally needs
a migration for the `sessions` table with an `expires_at` index; no
migration applies to any other task).

## 0. Resolve the open design question

- [ ] 0.1 Confirm session store: Redis (as designed) or Postgres (see
      `design.md`'s comparison table). This gates every task in section 1.

## 1. Session store foundation

- [ ] 1.1 Define `ISessionStore` port
      (`src/core/identity/application/ports/session-store.port.ts`) — DI
      token + interface: `set(key, value, ttlSeconds)`, `get(key)`,
      `delete(key)`. Used for both real sessions (`session:{id}`) and
      short-lived OAuth `state`/PKCE entries (`oauth:{nonce}`), different
      key prefixes and TTLs, same store.
- [ ] 1.2 Add `ioredis` to `package.json`. Implement
      `RedisSessionStore` (`infrastructure/session/redis-session.store.ts`)
      — or the Postgres equivalent per 0.1. Unit tests against a mocked
      Redis client (or a real ephemeral Postgres table in
      `test/integration/` if that path is chosen).
- [ ] 1.3 Extend `env.validation.ts` with `OAUTH_SESSION_ENABLED`
      (`z.enum(['true', 'false']).optional()`), `SESSION_REDIS_URL`,
      `SESSION_COOKIE_NAME` (default `session`), `SESSION_TTL_SECONDS`
      (default e.g. `86400`), `OAUTH_REDIRECT_URI`,
      `OAUTH_SUCCESS_REDIRECT_URL`. `superRefine` fail-fast: all of these
      (except the two with defaults) required when
      `OAUTH_SESSION_ENABLED=true`; `OAUTH_SESSION_ENABLED=true` also
      requires `IDENTITY_PROVIDER` to be set (mirrors the existing
      `TENANCY_ENABLED -> IDENTITY_PROVIDER` check).
- [ ] 1.4 Add `cookie-parser` to `package.json`, wire it in `src/main.ts`
      unconditionally (see design decision 7 — inert without a cookie).
- [ ] 1.5 Update `.env.example` and local `docker-compose.yml` with a
      Redis service (or the Postgres migration, per 0.1), commented/opt-in
      to match the `IDENTITY_PROVIDER` vars' existing style.

## 2. Extend `IIdentityProvider` and its adapters

- [ ] 2.1 Add `getAuthorizationUrl(options)` and
      `exchangeAuthorizationCode(options)` to
      `identity-provider.port.ts`, plus their option interfaces
      (`authorization-url-options.interface.ts`,
      `authorization-code-exchange.interface.ts` — one type per file, per
      repo convention).
- [ ] 2.2 Implement both methods on `CognitoIdentityProvider` using Hosted
      UI's `/oauth2/authorize` and `/oauth2/token` endpoints (new
      `COGNITO_HOSTED_UI_DOMAIN` env var). Unit tests mocking the HTTP
      calls (Hosted UI is plain OAuth2 over HTTPS, not an AWS SDK command).
- [ ] 2.3 Implement both methods on `SupabaseIdentityProvider` using
      `supabase.auth.signInWithOAuth({ provider, options: { redirectTo,
      skipBrowserRedirect: true } })` to obtain the URL, and
      `supabase.auth.exchangeCodeForSession(code)` for the callback. Unit
      tests mocking the Supabase client.
- [ ] 2.4 Implement both methods on `OidcIdentityProvider` using
      `openid-client`'s `buildAuthorizationUrl()`/
      `authorizationCodeGrant()`, PKCE-enabled. Unit tests mocking
      `openid-client`.
- [ ] 2.5 Update each provider's existing unit test suites to cover the
      new port methods alongside the existing ones (`login`,
      `refreshToken`, `verifyToken` tests already exist per provider).

## 3. OAuth state/PKCE service and controller

- [ ] 3.1 Implement `OAuthStateService`
      (`application/services/oauth-state.service.ts`): generates a nonce +
      `state` + PKCE pair, persists via `ISessionStore` with a short TTL
      (e.g. 5 minutes), and a `consume(nonce, state)` method that verifies
      and deletes atomically (single-use).
- [ ] 3.2 Implement `OAuthController`
      (`transport/rest/oauth.controller.ts`): `GET /auth/oauth/start`,
      `GET /auth/oauth/callback`, `POST /auth/logout`. Entry logging per
      the repo's logging convention (log the nonce/session id, never the
      token set). Only registered when `OAUTH_SESSION_ENABLED=true`
      (conditional import in `identity.module.ts`, same pattern
      `core.module.ts` uses for `IDENTITY_PROVIDER`-gated `IdentityModule`
      import).
- [ ] 3.3 Session cookie helper (set/clear with `HttpOnly`/`Secure`/
      `SameSite=Lax`, `Max-Age` from `SESSION_TTL_SECONDS`) — small enough
      to be a private method on `OAuthController` unless reused elsewhere,
      in which case extract to `infrastructure/session/session-cookie.ts`.

## 4. `IdentityGuard` session resolution + silent refresh

- [ ] 4.1 Extend `IdentityGuard.canActivate()`: if `OAUTH_SESSION_ENABLED`
      and a session cookie is present, resolve via `ISessionStore` instead
      of the `Authorization` header. Missing/invalid session -> `401`
      (same as an invalid bearer token today).
- [ ] 4.2 Implement silent refresh inside that path: if the stored
      `accessToken` is past `expiresAt`, call
      `IIdentityProvider.refreshToken()` with the stored `refreshToken`,
      update the session record (new token set, reset TTL) via
      `ISessionStore`, and continue. If the provider rejects the refresh,
      delete the session and reject with `401`.
- [ ] 4.3 Unit tests: session-cookie-present-and-valid,
      session-cookie-takes-precedence-over-bearer-header,
      no-cookie-falls-back-to-bearer (existing behavior unchanged),
      session-not-found, expired-token-silently-refreshed,
      refresh-rejected-destroys-session. All with `jest.Mocked<ISessionStore>`
      + `jest.Mocked<IIdentityProvider>`, no `@nestjs/testing`.

## 5. Module wiring

- [ ] 5.1 Update `identity.module.ts`: add `SESSION_STORE` provider,
      `OAuthStateService`, conditionally register `OAuthController` (per
      3.2), export `SESSION_STORE`/`ISessionStore` token if any future
      context needs session data directly (unlikely — flag as YAGNI if no
      concrete need surfaces during implementation).

## 6. Tests & docs

- [ ] 6.1 E2E tests (`test/oauth-session.e2e-spec.ts`): full
      start -> callback -> authenticated-request -> logout flow against a
      mocked `IIdentityProvider` (same dynamic-`IDENTITY_PROVIDER`-import
      trick `identity.e2e-spec.ts` uses) and a real Redis (or the chosen
      store) via testcontainers, matching this repo's existing
      `@testcontainers/postgresql` pattern for `test:e2e`. Cover: state
      mismatch rejected, expired-token-refreshed-silently (assert no
      client-visible difference), session cookie takes precedence over a
      bearer header when both present, logout clears the cookie and a
      subsequent request with the same (now-stale) cookie gets `401`.
- [ ] 6.2 Update `src/core/identity/README.md`: document both login paths
      side by side (when to use bearer-token vs cookie-session), the new
      env vars, and a sequence summary linking to `design.md`.
- [ ] 6.3 Update root `README.md`'s Identity row to mention the OAuth/BFF
      path.

## 7. Verification

- [ ] 7.1 `pnpm lint`, `tsc --noEmit`, `pnpm test`, `pnpm test:e2e` all
      pass.
- [ ] 7.2 `pnpm test:cov` meets the repo's 80% coverage threshold for the
      new/changed code.
- [ ] 7.3 Manual check: full OAuth round trip against a real
      Supabase-with-Google-configured project (or whichever provider is
      available), confirming the browser never receives the provider's
      `accessToken`/`refreshToken` in any network response (inspect
      DevTools Network tab).
