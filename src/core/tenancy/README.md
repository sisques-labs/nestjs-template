# Tenancy

Cross-cutting multi-tenancy enforcement — not a bounded context. The actual
`Tenant` business data (an internal id, a link to the IdP's tenant claim)
lives in `src/contexts/tenant/`, this template's first bounded context; this
module only enforces that a request's data stays scoped to its own tenant.
Inert by default: unless `TENANCY_ENABLED=true`, `TenancyModule` isn't
imported into `CoreModule` and nothing about the app's behavior changes.

## Enabling it

Set `TENANCY_ENABLED=true`. Requires `IDENTITY_PROVIDER` to also be set
(`TenantGuard` reads `IPrincipal.tenantId`, so there must be a principal to
read it from) — missing that dependency fails application boot (see
`src/core/config/env.validation.ts`).

## What it provides

- **`TenantContextService`** — `AsyncLocalStorage`-backed accessor for "the
  current tenant" during a request. `run<T>(tenantId, callback)` establishes
  the tenant id for a callback and everything it calls (including nested
  `await`s); `get()` reads it back, returning `undefined` outside any
  `run()`. Deliberately a plain singleton, not a request-scoped provider —
  see the doc comment on the class for why.
- **`TenantGuard`** — runs after `IdentityGuard`, reads `IPrincipal.tenantId`
  from the already-attached principal, dispatches
  `UpsertTenantFromClaimCommand` (lazy find-or-create), and attaches the
  resolved internal `Tenant` id to the request.
- **`TenantContextInterceptor`** — runs after the guards, wraps the rest of
  the request in `TenantContextService.run()` so `TenantContextService.get()`
  reliably returns the current tenant's internal id anywhere in the request,
  including inside a repository query a handler `await`s. Always pair the
  guard with the interceptor:
  ```ts
  @UseGuards(IdentityGuard, TenantGuard)
  @UseInterceptors(TenantContextInterceptor)
  ```
  See the doc comments on `tenant.guard.ts` and
  `tenant-context.interceptor.ts` for why seeding the context needs both —
  in short, `AsyncLocalStorage.enterWith()` from inside a guard's
  `canActivate()` does not reliably propagate into the route handler through
  Nest's RxJS-based guard/interceptor/handler composition; `run()` wrapping
  the handler invocation from the interceptor does.
- **`TenantScopedRepository`** — abstract base class a future bounded
  context's TypeORM repository extends instead of extending
  `BaseDatabaseRepository` directly, to get every query automatically
  filtered to the current tenant.

## `TenantScopedRepository`

Read `tenant-scoped.repository.ts` for the full doc comments. In short:

- It extends `BaseDatabaseRepository` (from `@sisques-labs/nestjs-kit`, the
  same base `TenantTypeOrmWriteRepository`/`TenantTypeOrmReadRepository` in
  `src/contexts/tenant/` extend) — subclasses inherit `calculatePagination`
  for free.
- It exposes a protected `tenantScopedQueryBuilder(repository, alias)`
  method: given a `Repository<Entity>` and an alias, it returns a
  `SelectQueryBuilder<Entity>` with `{alias}.tenantId = :tenantId` already
  applied, sourced from `TenantContextService.get()`.
- If `TenantContextService.get()` returns `undefined` — no tenant context
  present, e.g. called from a background job outside any guarded request —
  it **throws immediately**, before building or returning any query
  builder, rather than risk executing an unscoped query that could leak
  every tenant's rows.

**Convention it depends on**: every entity that will extend this pattern
must have a `tenantId: string` property (mapped via
`@Column({ name: '...' })` to whatever the actual DB column is, e.g.
`tenant_id`). Nothing in the type system enforces this — `ObjectLiteral`,
the constraint TypeORM itself puts on `Repository`/`SelectQueryBuilder`,
carries no field information — so this is a convention documented here and
in the class's own doc comment, the same way other cross-context
conventions in this template are enforced by documentation/review rather
than generics.

### How a future context uses it

```ts
@Injectable()
export class OrderTypeOrmReadRepository
  extends TenantScopedRepository
  implements IOrderReadRepository
{
  constructor(
    @InjectRepository(OrderEntity)
    private readonly repository: Repository<OrderEntity>,
    private readonly mapper: OrderTypeOrmMapper,
    tenantContextService: TenantContextService,
  ) {
    super(tenantContextService);
  }

  async findByCriteria(
    criteria: Criteria,
  ): Promise<PaginatedResult<OrderViewModel>> {
    const { page, limit, skip } = await this.calculatePagination(criteria);

    const [entities, total] = await applyCriteriaToQueryBuilder(
      this.tenantScopedQueryBuilder(this.repository, 'order'),
      criteria,
      { alias: 'order', defaultSort: { field: 'createdAt', direction: SortDirection.DESC } },
    )
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return new PaginatedResult(
      entities.map((entity) => this.mapper.toViewModel(entity)),
      total,
      page,
      limit,
    );
  }

  // ...
}
```

### No context extends this yet

This template still ships with `src/contexts/tenant/` as its only bounded
context, and that context's own repositories (`TenantTypeOrmReadRepository`,
`TenantTypeOrmWriteRepository`) do **not** extend `TenantScopedRepository` —
the `tenants` table has no `tenant_id` column, since a `Tenant` row *is* the
tenant, not something scoped to one. `TenantScopedRepository` is
documentation and a base class waiting for the first tenant-owned context
(e.g. a future `Order` or `User` context) to extend it — not a retrofit of
anything existing.

## Design notes / follow-ups

See `openspec/changes/add-tenant-context/` for the full proposal, design
rationale (including sequence diagrams), and delta specs. Explicitly out of
scope for v1: schema-per-tenant or database-per-tenant isolation (this
change only implements shared-row, `tenant_id`-column isolation), a tenant
admin API, and provider-webhook-driven tenant sync.
