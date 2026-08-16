# Add core identity module

## Why

The README explicitly lists auth (JWT/OAuth/sessions) as "deliberately not
included" in this template, pointing at the MCP `contextBuilder` extension
point and `base-exception.filter.ts` as where a service should wire its own
identity resolution once it needs one (`README.md`, "Deliberately not
included"; `src/core/core.module.ts:54-55` carries a literal TODO comment to
this effect on the `McpModule.forRoot(...)` call).

Every concrete service cloned from this template ends up re-solving the same
problem — verify a bearer token against whatever IdP it's paired with
(Cognito, Supabase, or something OIDC-compatible), normalize the provider's
claim shape, guard routes/resolvers, and proxy login/refresh — with no shared
place to put that logic. Without a reusable bridge, each service either
duplicates provider SDK wiring or invents its own ad hoc shape for "the
current user," and none of that logic can live in `src/contexts/` per the
architecture skill's cross-context boundary rules (a bounded context may not
own another context's concerns, and identity is not itself a business
domain).

## What Changes

- Add `src/core/identity/`, a cross-cutting infrastructure module (not a
  bounded context — it persists no local aggregate; the external IdP stays
  the source of truth):
  - `IIdentityProvider` port (`application/ports/`) with adapters
    (`infrastructure/providers/`) for **AWS Cognito**, **Supabase Auth**, and
    a **generic OIDC** provider (covers Auth0, Firebase, and any other
    OIDC-compliant IdP without a dedicated adapter).
  - A provider factory that resolves the single active adapter at boot from
    an `IDENTITY_PROVIDER` env var (`cognito` | `supabase` | `oidc`).
  - `IPrincipal` (normalized `sub`/`email`/`roles`/`tenantIds`) and a shared
    `Role` enum, with each adapter mapping its provider's raw claims
    (`cognito:groups`, `app_metadata.roles`, a configurable OIDC claim) onto
    it.
  - `IdentityGuard` + `@CurrentUser()`, `RolesGuard` + `@Roles()`, usable from
    REST controllers, GraphQL resolvers, and MCP tools.
  - A REST-only `transport/rest/auth.controller.ts` exposing
    `POST /auth/login` and `POST /auth/refresh` (the backend proxies
    credential login to the active provider; it is not client-side-only
    auth).
  - Admin-style user management delegated to the active provider:
    `createUser`, `disableUser`/`deleteUser`, `updateUserAttributes`,
    `resetPassword` — no local copy of the user is ever persisted.
- Extend `validateEnv` (`src/core/config/env.validation.ts`) with
  `IDENTITY_PROVIDER` and the per-provider env vars, fail-fast at boot when
  the selected provider is missing required config.
- Wire `IdentityModule` into `CORE_MODULES` in `src/core/core.module.ts` and
  resolve its existing TODO by passing a `contextBuilder` to
  `McpModule.forRoot(...)` that attaches the resolved `IPrincipal` (when a
  bearer token is present) to `IMcpToolContext`.
- New dependencies: `@aws-sdk/client-cognito-identity-provider`,
  `@supabase/supabase-js`, `openid-client`, `jose`.
- Update `README.md`'s "Deliberately not included" entry to point at this
  module as the built-in, opt-in way to add auth, instead of leaving it
  purely as a documented extension point with no implementation.

## Impact

- **Affected specs**: new capability `identity-bridge` (added), see
  `specs/identity-bridge/spec.md`.
- **Affected code**: `src/core/identity/**` (new),
  `src/core/core.module.ts` (module wiring + MCP `contextBuilder`),
  `src/core/config/env.validation.ts` (new env vars), `package.json` /
  lockfile (new deps), `.env.example` (new example vars), `README.md`.
- **Bounded contexts impacted**: none. `src/contexts/` is untouched; this
  change is entirely inside `src/core/`, matching the architecture skill's
  rule that cross-context shared utilities live in `src/core/`.
- **Breaking changes**: none. The module is inert unless `IDENTITY_PROVIDER`
  is set — no guard is registered globally, so a service that doesn't opt in
  keeps behaving exactly as it does today.
- **Out of scope for this change** (explicitly not decided/implemented
  here, tracked as follow-ups):
  - Rate limiting / brute-force protection on `POST /auth/login`.
  - Multi-provider-at-once / per-tenant provider selection (v1 is one active
    provider per deployment).
  - A local/dev fake provider adapter for testing without a real IdP —
    tests in this change use a mocked `IIdentityProvider`, not a shipped
    "fake" provider product feature.
  - Persisting an app-local user profile/aggregate (e.g. preferences, an
    internal-only role set) — if a service needs that later, it becomes its
    own bounded context in `src/contexts/`, consuming this module's
    `IPrincipal` as its identity source, not the other way around.

## Rollback Plan

- The module is purely additive and gated behind `IDENTITY_PROVIDER`:
  unsetting it (or not importing `IdentityModule`) restores current
  behavior exactly, since no guard is registered globally by default.
- If a specific provider adapter misbehaves in production,
  `IDENTITY_PROVIDER` can be switched to another supported value, or unset
  entirely, without a code deploy — only env config changes.
- Full revert = revert the commit(s) adding `src/core/identity/`, the
  `CoreModule` wiring line, the `McpModule.forRoot(...)` `contextBuilder`
  change, and the new `package.json` dependencies. No data migration exists
  to unwind, since the module persists nothing of its own.
