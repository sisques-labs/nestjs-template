# Add tenant context

## Why

`IPrincipal.tenantId` (introduced by `add-core-identity-module`) already
carries a tenant identifier when the active provider's claims include one
(a Cognito custom attribute, Supabase `app_metadata.tenant_id`, or a
generic OIDC claim) — but nothing in this template does anything with it.
There is no `Tenant` record, no enforcement that a request's data actually
belongs to its own tenant, and no repository-level guarantee against one
tenant reading or writing another's rows. A service that clones this
template and needs multi-tenancy today has to build all of that from
scratch, on every context it adds, with no shared safety net.

This mirrors why `add-core-identity-module` existed: multi-tenancy is
common enough to deserve a reusable pattern, but specific enough (which
isolation model, how tenants get created) that it shouldn't be silently
baked in. This change adds that pattern as an opt-in module, split the
same way identity was: cross-cutting enforcement infrastructure in
`src/core/`, and the actual `Tenant` business data as this template's
**first real bounded context** in `src/contexts/tenant/`.

## What Changes

- **`src/contexts/tenant/`** (new bounded context, DDD+CQRS+Hexagonal —
  see the `architecture` skill): a `Tenant` aggregate (`id` — internal
  UUID, `externalId` — the IdP-supplied `tenant_id` claim, unique) and a
  single `upsert-tenant-from-claim` command whose handler finds-or-creates
  a `Tenant` row the first time a given `externalId` is seen and returns
  its internal id. No `status` field or admin operations in v1 — see "Out
  of scope" below; nothing in this change would ever set one. Persisted
  via TypeORM (`tenants` table, one migration). Registered in
  `CONTEXT_MODULES` (`src/contexts/contexts.module.ts`).
- **`src/core/tenancy/`** (new cross-cutting module, mirrors
  `src/core/identity/`):
  - `TenantContextService` — `AsyncLocalStorage`-backed accessor for "the
    current tenant" during a request, populated by...
  - `TenantGuard` — runs after `IdentityGuard`, reads `IPrincipal.tenantId`
    from the already-attached principal, dispatches
    `upsert-tenant-from-claim` (lazy upsert, no provider webhooks needed:
    works identically for Cognito, Supabase, and generic OIDC), and seeds
    `TenantContextService` for the rest of the request.
  - `TenantScopedRepository` — a base class future bounded-context TypeORM
    repositories extend so every query is automatically filtered to
    `tenant_id = :current` (reads `TenantContextService`) without each
    context having to remember to do it.
- `TENANCY_ENABLED` env var (default off) — opt-in, mirrors
  `IDENTITY_PROVIDER`: unset, this module isn't imported into
  `CORE_MODULES` and nothing about existing behavior changes. Depends on
  `IDENTITY_PROVIDER` also being set (tenancy needs a principal to read
  `tenantId` from) — validated at boot.
- Adds a `tenant_id` column convention: any future bounded context that
  needs tenant isolation adds a `tenantId` column to its entities and
  extends `TenantScopedRepository` instead of the base repository classes.

## Impact

- **Affected specs**: two new capabilities —
  `tenant-context` (the aggregate/commands/queries) and
  `tenancy-enforcement` (guard + scoping infra), both added.
- **Affected code**: `src/contexts/tenant/**` (new, first bounded
  context), `src/contexts/contexts.module.ts` (register it),
  `src/core/tenancy/**` (new), `src/core/core.module.ts` (wire
  `TenancyModule` when enabled), `src/core/config/env.validation.ts`
  (`TENANCY_ENABLED`), `src/database/migrations/` (new `tenants` table
  migration), `.env.example`.
- **Depends on**: `add-core-identity-module`
  (`IPrincipal.tenantId`, `IdentityGuard`) — this change cannot land before
  that one; `TenantGuard` is built directly on top of it.
- **Breaking changes**: none. Inert unless `TENANCY_ENABLED=true`, and
  even then it adds a new table/context rather than touching anything
  existing (there are no other bounded contexts yet for
  `TenantScopedRepository` to retrofit).
- **Explicitly out of scope for this change** (tracked as follow-ups):
  - Schema-per-tenant or database-per-tenant isolation — this change only
    implements shared-row (`tenant_id` column) isolation.
  - A tenant admin API (rename/suspend/delete a tenant, list tenants) —
    v1 only creates a `Tenant` via the lazy upsert; nothing manages it
    afterward.
  - Any webhook-based sync from a specific provider (e.g. Supabase Auth
    webhooks) — deliberately not built, so behavior stays identical across
    all three identity providers.
  - The `users` bounded context discussed alongside this — `Tenant` is
    designed so a future `User` aggregate can reference `tenantId`, but
    building `User` is not part of this change.

## Rollback Plan

- Gated entirely behind `TENANCY_ENABLED`: unset it (or don't import
  `TenancyModule`/register the `tenant` context) and the service behaves
  exactly as it does today.
- If enabled and later reverted, the `tenants` table and its migration can
  be dropped independently — no other context depends on it yet (`User`
  doesn't exist in this template).
- Full revert = revert the commit(s) adding `src/contexts/tenant/`,
  `src/core/tenancy/`, the `CoreModule`/`ContextsModule` wiring, the new
  env var, and the `tenants` migration (with a corresponding down
  migration).
