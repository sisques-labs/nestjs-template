# Users

This template's second bounded context. A `User` is a tenant-scoped profile:
an internal `id`, a `tenantId` (the owning `Tenant`'s internal id), the
IdP-supplied `externalId` (`sub` claim), `email` (synced from the verified
token, never user-editable), and two user-owned fields, `displayName` and
`avatarUrl` (both start unset — `displayName` defaults from the email
claim, `avatarUrl` starts `null` — and are only ever changed via
`PATCH /users/me`). Lazily created the first time a given principal is
seen within a given tenant — see `openspec/changes/add-users-context/` for
the full proposal and design rationale.

## What it provides

- **`UpsertUserFromClaimCommand`** (`application/commands/`) —
  `CommandBus.execute(new UpsertUserFromClaimCommand({ tenantId, externalId, email }))`
  finds the `User` for that `(tenantId, externalId)` pair, or creates one if
  this is the first time it's been seen, re-syncing `email` either way, and
  returns the current `UserViewModel`.
- **`UpdateUserProfileCommand`** — same find-or-create path, then always
  applies the requested `displayName` and, only when the caller's input
  included the key at all, applies `avatarUrl` (a three-state field:
  omitted = untouched, `null` = cleared, a URL = set — see the command's
  doc comment). A caller can set their profile on their very first
  request, without a prior upsert having created the row first.

Both commands return a `UserViewModel`, not just an id — unusual for a
command handler in this codebase, but the self-service `/users/me` REST
surface (added in a later layer) needs the full current profile for its
response, not a separate read after every write.

No `application/queries/` — see `design.md`'s "Split rationale" for why
find-or-create is a write-side concern here, the same reasoning
`add-tenant-context`'s design used for `Tenant`'s own upsert.

No `transport/` subtree yet — added in a later layer as
`GET /users/me` / `PATCH /users/me`, gated behind
`IDENTITY_PROVIDER && TENANCY_ENABLED` (see "Persistence" below and
`design.md` decision 5).

## Structure

```
users/
├── domain/
│   ├── aggregates/user.aggregate.ts           — UserAggregate; create() emits UserCreatedEvent; rename()/syncEmail() don't
│   ├── builders/user.builder.ts                — UserBuilder (the only way to construct one)
│   ├── events/user-created/                    — UserCreatedEvent
│   ├── interfaces/user.interface.ts             — IUser (value-object shape)
│   ├── primitives/user.primitives.ts            — UserPrimitives (serialized shape)
│   ├── repositories/{read,write}/               — IUserReadRepository / IUserWriteRepository + DI tokens
│   ├── value-objects/
│   │   ├── user-id/                             — UserIdValueObject
│   │   ├── user-tenant-id/                      — UserTenantIdValueObject (this context's own Tenant reference)
│   │   ├── user-external-id/                    — UserExternalIdValueObject (non-empty string)
│   │   └── user-display-name/                   — UserDisplayNameValueObject (non-empty, max length)
│   │       (avatarUrl uses nestjs-kit's UrlValueObject directly — no local subclass, same as email/EmailValueObject)
│   └── view-models/user.view-model.ts           — UserViewModel (read-side projection)
├── application/
│   ├── commands/
│   │   ├── upsert-user-from-claim/              — UpsertUserFromClaimCommand + handler
│   │   └── update-user-profile/                 — UpdateUserProfileCommand + handler
│   └── services/write/
│       └── find-or-create-user-by-external-id.service.ts — shared find-or-create-and-resync logic
├── infrastructure/
│   └── persistence/typeorm/
│       ├── entities/user.entity.ts              — `users` table (unique index on (tenant_id, external_id), FK to tenants)
│       ├── mappers/user-typeorm.mapper.ts        — entity ↔ UserAggregate/UserViewModel
│       └── repositories/                         — TypeORM read/write repository implementations
└── users.module.ts
```

## Persistence

One TypeORM entity, `users`, with a unique index on
`(tenant_id, external_id)` — uniqueness is scoped per tenant, not global
(see `design.md` decision 3) — and a database-level foreign key to
`tenants.id`. Migration:
`src/database/migrations/1787480945650-CreateUsers.ts`.

`UserEntity` does not extend `BaseTypeormEntity`, for the same reasons
`TenantEntity` doesn't — see that entity's doc comment. It also declares no
TypeORM relation to `TenantEntity`: the architecture skill's cross-context
boundary rule reserves reaching into another context for a port/adapter,
not a raw entity-to-entity relation, so referential integrity is enforced
at the database level only (the migration's `FOREIGN KEY` constraint), not
as a code-level relation object.

`UserTypeOrmReadRepository` is this template's **first real consumer of
`createTenantScopedRepository()`** (`src/core/tenancy/`) — its
`findById`/`findByCriteria` have no explicit tenant parameter, so ambient
scoping via `TenantContextService` is how they stay tenant-safe.
`UserTypeOrmWriteRepository` deliberately does **not** use it — every write
method either takes `tenantId` explicitly (`findByExternalId`) or receives
an aggregate whose `tenantId` is already set (`save`), so wrapping would
only add a hidden, untestable `TenantContextService` dependency for no
benefit. See each repository's own doc comment.

## Design notes / follow-ups

See `openspec/changes/add-users-context/` for the full proposal, design
rationale (including sequence diagrams), and delta specs. Explicitly out
of scope for v1: any field beyond `displayName`/`email`/`avatarUrl`, an
admin/by-id API, and a cross-cutting `core/`-level "current user" concept
analogous to `TenantContextService` — nothing outside this context needs
to resolve "the current user" yet.
