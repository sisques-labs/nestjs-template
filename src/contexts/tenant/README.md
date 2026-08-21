# Tenant

This template's first bounded context. A `Tenant` is deliberately minimal:
an internal `id` (UUID) and an `externalId` — the IdP-supplied `tenant_id`
claim (a Cognito custom attribute, Supabase `app_metadata.tenant_id`, or a
generic OIDC claim) that identifies which tenant a row belongs to. No
`status` field and no admin operations in v1 — nothing in this context
would ever set one (see `openspec/changes/add-tenant-context/proposal.md`,
"Out of scope").

## What it provides

- **`UpsertTenantFromClaimCommand`** (`application/commands/`) — the only
  public entry point. `CommandBus.execute(new UpsertTenantFromClaimCommand({ externalId }))`
  finds the `Tenant` for that `externalId`, or creates one if this is the
  first time it's been seen, and returns its internal `id` (a `string`).
  Unlike most command handlers in this codebase, `UpsertTenantFromClaimHandler`
  returns a value — the caller (`core/tenancy/`'s `TenantGuard`, added in a
  later change) needs the resolved id synchronously, within the same
  request, to seed request-scoped tenant context. `@nestjs/cqrs` supports a
  command handler's `execute()` returning a value; this is the one place in
  this context that relies on it.

No `transport/` subtree — this context has no REST/GraphQL/MCP surface in
v1. It is invoked exclusively via `CommandBus`, never called directly by
another context's domain/application (see the `architecture` skill's
cross-context boundary rule).

## Structure

```
tenant/
├── domain/
│   ├── aggregates/tenant.aggregate.ts         — TenantAggregate; create() emits TenantCreatedEvent
│   ├── builders/tenant.builder.ts             — TenantBuilder (the only way to construct one)
│   ├── events/tenant-created/                 — TenantCreatedEvent
│   ├── exceptions/                            — TenantExternalIdAlreadyExistsException
│   ├── interfaces/tenant.interface.ts         — ITenant (value-object shape)
│   ├── primitives/tenant.primitives.ts        — TenantPrimitives (serialized shape)
│   ├── repositories/{read,write}/             — ITenantReadRepository / ITenantWriteRepository + DI tokens
│   ├── value-objects/tenant-external-id/      — TenantExternalIdValueObject (non-empty string)
│   └── view-models/tenant.view-model.ts       — TenantViewModel (read-side projection)
├── application/
│   └── commands/upsert-tenant-from-claim/     — UpsertTenantFromClaimCommand + handler
├── infrastructure/
│   └── persistence/typeorm/
│       ├── entities/tenant.entity.ts          — `tenants` table (unique index on external_id)
│       ├── mappers/tenant-typeorm.mapper.ts   — entity ↔ TenantAggregate/TenantViewModel
│       └── repositories/                      — TypeORM read/write repository implementations
└── tenant.module.ts
```

## Persistence

One TypeORM entity, `tenants`, with a unique index on `external_id` — the
primary defense against duplicate `Tenant` rows for the same claim (see
`tenant-context` spec, "External id uniqueness"). Migration:
`src/database/migrations/1786818350610-CreateTenants.ts`.

`TenantEntity` does not extend `BaseTypeormEntity` from
`@sisques-labs/nestjs-kit/typeorm`: that base class names its columns after
the (camelCase) property names verbatim, and this app configures no global
naming strategy, so it would produce `createdAt`/`updatedAt` columns
instead of the `created_at`/`updated_at` this context's spec calls for; it
also adds a `deletedAt` soft-delete column this context has no use for.
`TenantTypeOrmReadRepository`/`TenantTypeOrmWriteRepository` likewise do
not extend `BaseTypeormMasterRepository` — that class resolves its
`Repository` from `TypeormMasterService`, provided only by the kit's own
`TypeOrmModule`, which this template does not import (`core.module.ts`
wires `@nestjs/typeorm`'s `TypeOrmModule.forRootAsync` directly, with
`autoLoadEntities: true` picking up `TenantModule`'s
`TypeOrmModule.forFeature([TenantEntity])`). Both repositories instead
compose a directly `@InjectRepository`-supplied `Repository<TenantEntity>`
and extend the engine-agnostic `BaseDatabaseRepository` for pagination.

## Design notes / follow-ups

See `openspec/changes/add-tenant-context/` for the full proposal and design
rationale (including sequence diagrams). Explicitly out of scope for v1: a
tenant admin API (rename/suspend/delete/list), any webhook-driven tenant
sync, and the `users` bounded context (designed to reference `Tenant.id`,
not built here). Tenant isolation enforcement (`TenantGuard`,
`TenantContextService`, `createTenantScopedRepository()`) lives in
`src/core/tenancy/`, added in a later change — this context only owns the
`Tenant` record itself.
