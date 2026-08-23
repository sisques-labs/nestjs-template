# Add users context

## Why

`add-core-identity-module` (#150–155) gives every request a verified,
provider-agnostic `IPrincipal` (`sub`, `email`, `roles`, `tenantIds`).
`add-tenant-context` (#156–161) gives every request a resolved, persisted
`Tenant`. Neither one gives the app anywhere to put or read app-local user
data — display name, or any future per-user preference — because neither
was meant to: both proposals explicitly listed a `users` bounded context as
a deliberate follow-up, not part of their own scope (see `add-tenant-context`
proposal's "Out of scope" and its Rollback Plan: "`Tenant` is designed so a
future `User` aggregate can reference `tenantId`").

A service cloned from this template that wants to show "who is logged in"
beyond raw token claims — or store anything about a user the IdP doesn't
carry — currently has nowhere to put it. This change adds that: this
template's **second bounded context**, and the first one with both a
persisted aggregate and a REST surface.

## What Changes

- **`src/contexts/users/`** (new bounded context): a `User` aggregate —
  `id` (internal UUID), `tenantId` (reference to the owning `Tenant`,
  scoped the same way every future tenant-owned context will be),
  `externalId` (the IdP `sub` claim), `email` (from the token, nullable —
  `IPrincipal.email` already is), and two user-editable fields:
  `displayName` and `avatarUrl` (both nullable/defaulted, never derived
  from the token — there's no IdP claim for either). No locale/timezone,
  phone, or status field in v1 — see "Out of scope".
- **Lazy upsert, same pattern as `Tenant`**: no separate registration
  flow. The first authenticated, tenant-scoped request for a given
  `externalId` creates the `User` row (defaulting `displayName` to
  something derived from the token, see `design.md`); every subsequent
  request re-syncs `email` from the token (IdP-derived, never
  user-editable) and leaves `displayName` untouched. Unlike `Tenant`'s
  upsert (which runs inside `TenantGuard`, before a tenant id even
  exists), the `users` upsert runs from the route handler itself — see
  `design.md`'s "Why not a `UserGuard`" for why that placement, not a
  guard, is correct here.
- **REST**: `GET /users/me` (resolves-and-returns the caller's own
  profile, upserting if this is their first request) and
  `PATCH /users/me` (updates `displayName`, required and always applied,
  and/or `avatarUrl`, optional and three-state: the key omitted leaves it
  untouched, `null` clears it, a URL string sets it — `email`,
  `externalId`, and `tenantId` are derived from the verified token/tenant
  resolution and are never client-writable). Both behind
  `IdentityGuard` + `TenantGuard` + `TenantContextInterceptor` — a caller
  can only ever read or write their *own* profile; there is no
  by-id lookup and no admin surface. No GraphQL or MCP surface in v1.
- **Depends on**: `add-core-identity-module` (`IPrincipal`, `IdentityGuard`,
  `@CurrentUser()`) and `add-tenant-context` (`TenantGuard`,
  `TenantContextService`, `TenantScopedRepository`) — this change cannot
  land before both of those. Stacked on top of `claude/tenant-t5-tests-docs`
  (the tip of the tenant stack), the same way that stack was stacked on
  identity's.

## Impact

- **Affected specs**: two new capabilities — `user-profile` (the
  aggregate, the upsert-by-claim and update-display-name commands) and
  `user-self-service-api` (the `/users/me` REST surface and its
  authorization semantics), both added.
- **Affected code**: `src/contexts/users/**` (new),
  `src/contexts/contexts.module.ts` (register it),
  `src/database/migrations/` (new `users` table migration, FK to
  `tenants`), `.env.example` / README updates only if a new opt-in flag
  turns out to be needed (see `design.md` — current plan reuses the
  existing `IDENTITY_PROVIDER`/`TENANCY_ENABLED` flags, no new env var).
- **Breaking changes**: none. The `users` context's domain/application/
  infrastructure providers register unconditionally (harmless — nothing
  calls them unless something dispatches their commands, same as
  `TenantModule` today), but its REST controller registers **only** when
  both `IDENTITY_PROVIDER` and `TENANCY_ENABLED` are set — see
  `design.md` decision 6 for why this guard is necessary here in a way it
  wasn't for the `tenant` context (which shipped with no transport at
  all).
- **Explicitly out of scope for this change** (tracked as follow-ups):
  - Any field beyond `displayName`/`avatarUrl`/`email`/`externalId`/
    `tenantId` — locale/timezone, phone, account status
    (active/disabled/invited).
  - An admin API (list/view/disable users within a tenant) — v1 is
    self-service only (`/me`), no by-id lookup for anyone else.
  - A cross-cutting "current local user" concept in `src/core/` analogous
    to `TenantContextService` — nothing outside this context needs to
    resolve "the current user" yet (e.g. as an audit-trail `createdBy`).
    If/when a future context needs that, promoting resolution into a
    guard + `AsyncLocalStorage` service (mirroring `core/tenancy/`) is
    the natural next step, deliberately not built here.
  - GraphQL and MCP surfaces for `users`.

## Rollback Plan

- The `users` context's providers are inert unless something dispatches
  their commands; the REST controller is gated behind the same
  `IDENTITY_PROVIDER`/`TENANCY_ENABLED` flags `identity`/`tenancy` already
  require — unset either and `/users/me` simply doesn't exist, same as
  today.
- If enabled and later reverted: the `users` table and its migration can
  be dropped independently (no other context references `User.id` yet).
- Full revert = revert the commit(s) adding `src/contexts/users/`, the
  `ContextsModule` registration, and the `users` migration (with a
  corresponding down migration).
