# tenant-context

## ADDED Requirements

### Requirement: Upsert tenant by external id

`UpsertTenantFromClaimCommand` MUST create a `Tenant` when no row exists
for the given `externalId`, and MUST NOT create a duplicate row when one
already exists for that `externalId` — the operation is idempotent.

#### Scenario: No existing tenant for this externalId

- **GIVEN** no `Tenant` row exists with `externalId = "tenant-42"`
- **WHEN** `UpsertTenantFromClaimCommand({ externalId: "tenant-42" })` is
  dispatched
- **THEN** a new `Tenant` row is created with that `externalId`
- **AND** the command handler returns the new row's internal id

#### Scenario: Existing tenant for this externalId

- **GIVEN** a `Tenant` row already exists with `externalId = "tenant-42"`
  and internal id `t-1`
- **WHEN** `UpsertTenantFromClaimCommand({ externalId: "tenant-42" })` is
  dispatched again
- **THEN** no new row is created
- **AND** the command handler returns `t-1`

### Requirement: External id uniqueness

The `tenants` table MUST enforce a unique constraint on `external_id`, so
that a race between two concurrent upserts for the same `externalId`
cannot produce two `Tenant` rows.

#### Scenario: Concurrent upsert for the same externalId

- **GIVEN** two requests both trigger
  `UpsertTenantFromClaimCommand({ externalId: "tenant-42" })` at
  approximately the same time, before either has committed
- **WHEN** both commands run
- **THEN** exactly one `Tenant` row with `externalId = "tenant-42"` MUST
  exist afterward, enforced by the database's unique constraint rather
  than an application-level check alone
