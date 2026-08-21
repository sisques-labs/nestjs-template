# Identity

A provider-agnostic identity bridge — not a bounded context. It persists
nothing of its own; the external identity provider (Cognito, Supabase, or
any OIDC-compliant IdP) is always the source of truth for users. Inert by
default: unless `IDENTITY_PROVIDER` is set, this module isn't even imported
into `CoreModule` and nothing about the app's behavior changes.

## Enabling it

Set `IDENTITY_PROVIDER` to one of `cognito`, `supabase`, or `oidc`, plus
that provider's required vars (see `.env.example`):

| Provider   | Required vars                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| `cognito`  | `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_REGION`                                           |
| `supabase` | `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`                                      |
| `oidc`     | `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` (optional `OIDC_ROLE_CLAIM`, default `roles`) |

Missing vars for the selected provider fail application boot (see
`src/core/config/env.validation.ts`), before the HTTP server starts
listening. Only one provider is active per deployment.

## What it provides

- **`POST /auth/login`, `POST /auth/refresh`** (`AuthController`) — backend-
  proxied login/refresh against the active provider. Credentials are
  forwarded straight through and never logged or persisted; only the
  submitted email is logged on entry.
- **`IdentityGuard`** — verifies the `Authorization: Bearer <token>` header
  against the active provider and attaches a normalized `IPrincipal`
  (`sub`, `email`, `roles`, `tenantIds`) to the request. `tenantIds` is every
  tenant the principal is a verified member of (an empty array means no
  tenant membership) — see `src/core/tenancy/README.md` for how a request
  picks one of them via the `X-Tenant-Id` header. Works for REST and
  GraphQL.
- **`RolesGuard` + `@Roles(...)`** — enforces role metadata against the
  attached principal. Run after `IdentityGuard`:
  `@UseGuards(IdentityGuard, RolesGuard)`.
- **`@CurrentUser()`** — extracts the attached `IPrincipal` in a
  handler/resolver.
- **MCP**: `core.module.ts` passes `IdentityMcpContextBuilder` to
  `McpModule.forRoot({ contextBuilder })` when enabled, so MCP tools can
  read the same `IPrincipal` off `IMcpToolContext.principal` (present only
  when the request carried a valid bearer token — a missing/invalid token
  never rejects an MCP request at the context-builder level).

None of the guards are applied globally — importing this module never
starts requiring auth on existing routes. Apply `IdentityGuard`/`RolesGuard`
explicitly on whichever controllers/resolvers a service adds.

```ts
@UseGuards(IdentityGuard, RolesGuard)
@Roles(Role.ADMIN)
@Get('admin-only')
adminOnly(@CurrentUser() user: IPrincipal) { ... }
```

## OAuth / social login (BFF cookie-session)

A second, opt-in login path alongside `POST /auth/login`: instead of the
frontend holding a bearer token, the backend acts as a Backend-for-Frontend
(BFF) — it drives the OAuth authorization-code flow, holds the provider's
`accessToken`/`refreshToken` server-side, and gives the browser only an
opaque, `HttpOnly` session cookie. Use whichever path fits the client:

| Client                                             | Path                     |
| --------------------------------------------------- | ------------------------ |
| Mobile apps, service-to-service, API/CLI clients     | Bearer token (`/auth/login`) |
| Browser-based frontends wanting social login, without ever holding provider tokens | Cookie session (`/auth/oauth/*`) |

### Enabling it

Set `OAUTH_SESSION_ENABLED=true`, on top of an already-configured
`IDENTITY_PROVIDER` (required — the OAuth flow still resolves against the
same active adapter). Also required:

| Var                          | Purpose                                                              |
| ----------------------------- | ---------------------------------------------------------------------- |
| `SESSION_REDIS_URL`           | Redis connection string backing `ISessionStore`                        |
| `OAUTH_REDIRECT_URI`          | Callback URL registered with the provider (`GET /auth/oauth/callback`) |
| `OAUTH_SUCCESS_REDIRECT_URL`  | Where the browser lands after a session is created                     |
| `SESSION_COOKIE_NAME` (optional, default `session`) | Name of the session cookie |
| `SESSION_TTL_SECONDS` (optional, default `86400`)   | Session TTL, refreshed on every silent token refresh |

Cognito additionally requires `COGNITO_HOSTED_UI_DOMAIN`. Missing vars fail
application boot, same as the `IDENTITY_PROVIDER` vars above. When
`OAUTH_SESSION_ENABLED` is unset (the default), none of the below is
registered — `OAuthController`'s routes 404, and `IdentityGuard` behaves
exactly as it does today (bearer-only).

### What it adds

- **`GET /auth/oauth/start`, `GET /auth/oauth/callback`, `POST /auth/logout`**
  (`OAuthController`) — starts the provider's authorization-code (PKCE)
  flow, exchanges the callback's `code` for a token set and opens a
  server-side session, and destroys that session on logout. The provider's
  tokens never reach the browser — only the opaque session id, via an
  `HttpOnly`, `Secure`, `SameSite=Lax` cookie.
- **`IdentityGuard`** — tries the session cookie first when
  `OAUTH_SESSION_ENABLED` is on, falling back to the `Authorization: Bearer`
  header when there's no cookie. Both paths attach the same `IPrincipal`
  shape, so `@CurrentUser()`/`RolesGuard` don't need to know which one
  resolved it.
- **Silent refresh** — when a session's stored access token has expired,
  `IdentityGuard` transparently calls `IIdentityProvider.refreshToken()`
  with the stored refresh token and rewrites the session before continuing;
  the caller never sees a difference in the response. If the refresh is
  rejected (e.g. revoked at the provider), the session is destroyed and the
  request is rejected with `401` — a second request with the same cookie
  gets `401` again, not another refresh attempt.

See the `add-identity-oauth-bff` change proposal's `design.md` for the full
rationale (why Redis, why one guard instead of two, the cookie/PKCE
decisions) and its sequence diagrams for the exact start -> callback and
silent-refresh flows.

## User management

`IIdentityProvider` also exposes `createUser`, `disableUser`, `deleteUser`,
`updateUserAttributes`, and `resetPassword`, all delegated straight to the
active provider's admin API (`@Inject(IDENTITY_PROVIDER)` to use them
directly). The generic OIDC adapter rejects all five — OIDC has no standard
admin API surface, so only Cognito and Supabase support user management.

Supabase has no native "disable" operation; `disableUser` bans the account
for a very long duration instead (documented inline in
`supabase-identity.provider.ts`).

## Structure

```
identity/
├── domain/enums/role.enum.ts              — shared Role enum
├── application/
│   ├── ports/                             — IIdentityProvider + IPrincipal/ITokenSet/ISessionStore/ISessionRecord/etc.
│   └── services/
│       ├── identity-provider.factory.ts   — resolves the active adapter from IDENTITY_PROVIDER
│       └── oauth-state.service.ts         — PKCE + CSRF-state pair for the OAuth redirect flow
├── infrastructure/
│   ├── providers/{cognito,supabase,oidc}/ — one IIdentityProvider adapter each + its claims mapper
│   ├── guards/                            — IdentityGuard (bearer + session cookie), RolesGuard
│   ├── decorators/                        — @CurrentUser(), @Roles()
│   ├── session/                           — RedisSessionStore, session cookie helpers
│   └── mcp/                               — IdentityMcpContextBuilder
├── transport/rest/                        — AuthController + OAuthController + DTOs
└── identity.module.ts
```

`identity-provider.factory.ts` dynamically `import()`s only the selected
provider's adapter, so a service using Cognito never loads the Supabase or
OIDC SDKs (or vice versa) — see the comment in that file.

## Design notes / follow-ups

See `openspec/changes/add-core-identity-module/` for the bearer-token path's
full proposal, design rationale (including sequence diagrams), and delta
spec, and the `add-identity-oauth-bff` change proposal for the OAuth/BFF
session path's equivalent (design rationale, sequence diagrams, delta
spec). Explicitly out of scope for v1: rate limiting on `/auth/login`,
multi-provider / per-tenant selection, a local/dev fake provider,
persisting an app-local user profile (would be its own bounded context,
consuming `IPrincipal.sub` as a foreign identifier), account linking across
login methods for the same email, and "logout everywhere" (per-user session
enumeration + bulk destroy).
