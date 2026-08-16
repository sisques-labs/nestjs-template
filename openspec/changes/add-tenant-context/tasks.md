# Tasks: add-tenant-context

Depends on `add-core-identity-module` landing first (`IPrincipal.tenantIds`,
`IdentityGuard`, `getPrincipal()`/`getRequest()` helpers).

**Revision**: `TenantGuard` originally read a single `IPrincipal.tenantId`.
Post-review it was revised to resolve a tenant from `IPrincipal.tenantIds`
(a principal can belong to more than one tenant), narrowed by an optional
`X-Tenant-Id` request header — see `design.md`'s "Decisions" §6 and
`specs/tenancy-enforcement/spec.md` for the full behavior. Task 3.2 below
reflects the revised behavior.

## 1. `tenant` bounded context — domain

- [ ] 1.1 `TenantPrimitives` (extends `BasePrimitives`), `ITenant` interface,
      `TenantExternalIdValueObject` (extends `StringValueObject`,
      non-empty).
- [ ] 1.2 `TenantAggregate` (extends `BaseAggregate<TenantPrimitives>`):
      constructor = hydration only; `create()` emits `TenantCreatedEvent`.
      Unit tests (manual instantiation, no `@nestjs/testing`).
- [ ] 1.3 `TenantBuilder` (extends `BaseBuilder`), `TenantCreatedEvent`,
      `TenantViewModel` (extends `BaseViewModel`).
- [ ] 1.4 `ITenantReadRepository` / `ITenantWriteRepository` interfaces +
      DI tokens (Symbols) in `domain/repositories/{read,write}/`.

## 2. `tenant` bounded context — application + infrastructure

- [ ] 2.1 `UpsertTenantFromClaimCommand` (`{Name}CommandInput` with a
      primitive `externalId: string`, VO-wrapped in the constructor) +
      handler: find-or-create via `ITenantWriteRepository`, returns the
      resolved internal id. Unit tests covering both branches (create,
      already-exists) with `jest.Mocked<ITenantWriteRepository>`.
- [ ] 2.2 `tenant.entity.ts` (TypeORM, `tenants` table, unique index on
      `external_id`), `tenant-typeorm.mapper.ts`,
      `tenant-typeorm-{read,write}.repository.ts` (`useClass` DI, not
      `useExisting`).
- [ ] 2.3 Migration: create `tenants` table with the unique constraint on
      `external_id`. Add to `TEST_MIGRATIONS` in
      `test/helpers/test-data-source.ts` and `TRUNCATE_TABLES` in
      `test/helpers/db-reset.ts`.
- [ ] 2.4 `tenant.module.ts` (named provider arrays: `DOMAIN_BUILDERS`,
      `COMMAND_HANDLERS`, `INFRASTRUCTURE_REPOSITORIES`,
      `INFRASTRUCTURE_MAPPERS`, `INFRASTRUCTURE_ENTITIES`); register in
      `CONTEXT_MODULES` (`src/contexts/contexts.module.ts`). Always
      `CqrsModule` imported per convention.
- [ ] 2.5 `src/contexts/tenant/README.md`, per the apply-time rule: every
      bounded context's public API gets a README reflecting current state.

## 3. `core/tenancy/` — context service + guard

- [ ] 3.1 `TenantContextService` (`AsyncLocalStorage`-backed `get()`/`run()`).
      Unit tests: value present inside `run()`, `undefined` outside it,
      correctly isolated across concurrent `run()` calls.
- [ ] 3.2 `TenantGuard`: reads the principal via `IdentityGuard`'s exported
      `getPrincipal()`/`getRequest()`; 403s on a missing principal, an
      `X-Tenant-Id` header naming a tenant absent from `tenantIds`, an
      empty `tenantIds`, or (header absent) more than one entry in
      `tenantIds`; resolves the header value or the sole `tenantIds` entry
      otherwise; dispatches `UpsertTenantFromClaimCommand` via
      `CommandBus`; seeds `TenantContextService` for the rest of the
      request. Unit tests for all spec scenarios (header valid/invalid,
      zero/one/many `tenantIds` with no header).
- [ ] 3.3 `TENANCY_ENABLED` env var + `superRefine` check (requires
      `IDENTITY_PROVIDER` also set) in `src/core/config/env.validation.ts`,
      with tests extending `env.validation.spec.ts`. Add to `.env.example`.
- [ ] 3.4 `tenancy.module.ts`; wire into `CORE_MODULES` in
      `src/core/core.module.ts`, imported only when `TENANCY_ENABLED` is
      truthy (same pattern as `IdentityModule`).

## 4. Repository-level scoping

- [ ] 4.1 `TenantScopedRepository<Entity>` abstract base
      (`src/core/tenancy/infrastructure/persistence/typeorm/`): wraps a
      `Repository<Entity>`'s query builder, adds
      `tenant_id = :tenantId` from `TenantContextService.get()`, throws
      when no tenant context is present. Unit tests: scoped SQL contains
      the filter; throws with no context.
- [ ] 4.2 Document the `TenantScopedRepository` extension point in
      `src/core/tenancy/README.md` — no existing context needs it yet
      (this template still ships with `src/contexts/tenant/` as the only
      context), so this task is documentation + the base class, not a
      retrofit.

## 5. Tests & docs

- [ ] 5.1 E2E test (`test/tenancy.e2e-spec.ts`), following the pattern in
      `test/identity.e2e-spec.ts`: `TENANCY_ENABLED=true` +
      `IDENTITY_PROVIDER=oidc` (dummy config) set via dynamic import
      before `AppModule` loads, `IIdentityProvider` mocked. Covers: first
      request from a new tenant creates a `Tenant` row; second request
      from the same tenant does not create a duplicate; a principal with
      empty `tenantIds` gets 403; a principal with multiple `tenantIds`
      and no `X-Tenant-Id` header gets 403; the header selecting one of
      several valid tenants resolves to that tenant specifically; the
      header naming a tenant outside `tenantIds` gets 403; an ad-hoc route
      using `TenantScopedRepository` only returns rows for the current
      tenant (seed two tenants' worth of rows, assert isolation).
- [ ] 5.2 Update root `README.md`: add a `Tenancy` row to the features
      table; note the `users` bounded context (if/when proposed) will
      reference `Tenant.id`.

## 6. Verification

- [ ] 6.1 `pnpm lint`, `tsc --noEmit`, `pnpm test`, `pnpm test:e2e` all
      pass.
- [ ] 6.2 `pnpm test:cov` meets the repo's 80% coverage threshold.
- [ ] 6.3 Confirm `pnpm migration:run` / `:revert` both work cleanly
      against the new `tenants` migration (per the config.yaml rule that
      every DB-schema-changing task states its migration plan — this is
      it: one forward migration creating `tenants` with a unique index on
      `external_id`, one down migration dropping it, no data backfill
      needed since the table is new).
