# Tenancy

Cross-cutting multi-tenancy enforcement — not a bounded context. The actual
`Tenant` business data (an internal id, a link to the IdP's tenant claim)
lives in `src/contexts/tenant/`, this template's first bounded context; this
module only enforces that a request's data stays scoped to its own tenant.
Inert by default: unless `TENANCY_ENABLED=true`, `TenancyModule` isn't
imported into `CoreModule` and nothing about the app's behavior changes.

## Enabling it

Set `TENANCY_ENABLED=true`. Requires `IDENTITY_PROVIDER` to also be set
(`TenantGuard` reads `IPrincipal.tenantIds`, so there must be a principal to
read it from) — missing that dependency fails application boot (see
`src/core/config/env.validation.ts`).

## What it provides

- **`TenantContextService`** — `AsyncLocalStorage`-backed accessor for "the
  current tenant" during a request. `run<T>(tenantId, callback)` establishes
  the tenant id for a callback and everything it calls (including nested
  `await`s); `get()` reads it back, returning `undefined` outside any
  `run()`; `require()` does the same but throws `NoTenantContextException`
  instead of returning `undefined` — what `createTenantScopedRepository()`
  uses internally. Deliberately a plain singleton, not a request-scoped
  provider — see the doc comment on the class for why.
- **`TenantGuard`** — runs after `IdentityGuard`, resolves which of the
  principal's tenants the request operates against (see "Selecting a
  tenant: the `X-Tenant-Id` header" below), dispatches
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
- **`createTenantScopedRepository(repository, tenantContextService)`** — a
  factory a future bounded context's TypeORM repository calls once, in its
  constructor, to get a `Repository<Entity>` whose `findOne`/`find`/
  `findAndCount`/`save`/`delete` are transparently scoped to the current
  tenant.

## Selecting a tenant: the `X-Tenant-Id` header

A single principal can legitimately belong to more than one tenant —
`IPrincipal.tenantIds` (see `src/core/identity/`) is the full list the IdP's
verified claims proved membership in. Since one request only ever operates
against one tenant, the caller selects which via an `X-Tenant-Id` request
header, read by `TenantGuard`:

| Header               | `tenantIds`   | Result                                                             |
| -------------------- | ------------- | -------------------------------------------------------------------|
| present, in list     | any           | `200` — that tenant is used                                        |
| present, NOT in list | any           | `403` — a caller can never use the header to reach a tenant they don't belong to |
| absent                | exactly one   | `200` — that sole tenant is used (unambiguous default)             |
| absent                | zero          | `403` — no tenant claim at all                                     |
| absent                | more than one | `403` — ambiguous; the caller must specify the header              |

**Security property**: the header is client-supplied input and is never
trusted blindly — it only ever *selects among* tenants `tenantIds` already
proves membership in (`tenantIds` comes from a cryptographically verified
token; the header cannot grant access beyond what that token already
proves). It is required only when a principal has more than one tenant;
single-tenant principals don't need to send it.

## `TenantScopedRepository`

Read `create-tenant-scoped-repository.factory.ts` for the full doc
comments. In short:

- It wraps an `@InjectRepository`-supplied `Repository<Entity>` in a
  `Proxy`. `findOne`/`find`/`findAndCount` get `tenantId` merged into their
  `where`; `save` gets `tenantId` stamped onto the entity; `delete` gets
  `tenantId` merged into its criteria (accepting both a bare id and a
  criteria object, same as `Repository.delete()` itself). Every other
  method (`count`, `createQueryBuilder`, ...) passes straight through via
  `Reflect.get`.
- The tenant id comes from `TenantContextService.require()`, which
  **throws `NoTenantContextException` immediately** — before the wrapped
  method ever runs — if no tenant context is present (e.g. called from a
  background job outside any guarded request), rather than risk executing
  an unscoped query that could leak every tenant's rows.
- **`createQueryBuilder()` bypasses the proxy** — TypeORM builds a query
  builder from the underlying connection, not through `Repository`'s own
  `find*`/`save`/`delete` methods, so `Proxy` traps on those don't apply to
  it. A repository method that needs `createQueryBuilder()` (e.g.
  criteria-based pagination) must apply the tenant filter explicitly:
  `.andWhere('{alias}.tenantId = :tenantId', { tenantId:
  tenantContextService.require() })`.

**Convention it depends on**: every entity scoped this way must have a
`tenantId: string` property (mapped via `@Column({ name: '...' })` to
whatever the actual DB column is, e.g. `tenant_id`). Nothing in the type
system enforces this beyond the factory's own `Entity extends { tenantId:
string }` constraint — so this is also a convention documented here and in
the factory's own doc comment, the same way other cross-context
conventions in this template are enforced by documentation/review.

### How a future context uses it

```ts
@Injectable()
export class OrderTypeOrmReadRepository
  extends BaseDatabaseRepository
  implements IOrderReadRepository
{
  private readonly repository: Repository<OrderEntity>;

  constructor(
    @InjectRepository(OrderEntity)
    rawRepository: Repository<OrderEntity>,
    private readonly mapper: OrderTypeOrmMapper,
    private readonly tenantContextService: TenantContextService,
  ) {
    super();
    this.repository = createTenantScopedRepository(rawRepository, tenantContextService);
  }

  async findById(id: string): Promise<OrderViewModel | null> {
    // scoped automatically — no tenant filter to remember here
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toViewModel(entity) : null;
  }

  async findByCriteria(
    criteria: Criteria,
  ): Promise<PaginatedResult<OrderViewModel>> {
    const { page, limit, skip } = await this.calculatePagination(criteria);

    // createQueryBuilder bypasses the proxy, so the tenant filter is
    // applied explicitly here — see the factory's doc comment.
    const qb = this.repository
      .createQueryBuilder('order')
      .andWhere('order.tenantId = :tenantId', {
        tenantId: this.tenantContextService.require(),
      });

    const [entities, total] = await applyCriteriaToQueryBuilder(qb, criteria, {
      alias: 'order',
      defaultSort: { field: 'createdAt', direction: SortDirection.DESC },
    })
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

### No context uses this yet

This template still ships with `src/contexts/tenant/` as its only bounded
context, and that context's own repositories (`TenantTypeOrmReadRepository`,
`TenantTypeOrmWriteRepository`) do **not** use
`createTenantScopedRepository()` — the `tenants` table has no `tenant_id`
column, since a `Tenant` row *is* the tenant, not something scoped to one.
It's documentation and a factory waiting for the first tenant-owned context
(e.g. a future `Order` or `User` context) to call it — not a retrofit of
anything existing.

## Design notes / follow-ups

See `openspec/changes/add-tenant-context/` for the full proposal, design
rationale (including sequence diagrams), and delta specs. Explicitly out of
scope for v1: schema-per-tenant or database-per-tenant isolation (this
change only implements shared-row, `tenant_id`-column isolation), a tenant
admin API, and provider-webhook-driven tenant sync.
