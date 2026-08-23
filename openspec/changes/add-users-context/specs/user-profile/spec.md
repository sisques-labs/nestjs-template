# user-profile

## ADDED Requirements

### Requirement: Upsert user by tenant-scoped external id

`UpsertUserFromClaimCommand` MUST create a `User` when no row exists for
the given `(tenantId, externalId)` pair, and MUST NOT create a duplicate
row when one already exists — the operation is idempotent. On every call
(create or find), the stored `email` MUST be synced to the value supplied
in the command.

#### Scenario: No existing user for this tenant + externalId

- **GIVEN** no `User` row exists for `tenantId = "t-1"` and
  `externalId = "sub-42"`
- **WHEN** `UpsertUserFromClaimCommand({ tenantId: "t-1", externalId: "sub-42", email: "a@example.com" })`
  is dispatched
- **THEN** a new `User` row is created with that `tenantId`/`externalId`/`email`
- **AND** `displayName` is set to `"a"` (the email's local part)
- **AND** the command handler returns the new row as a `UserViewModel`

#### Scenario: No existing user and no email claim

- **GIVEN** no `User` row exists for `tenantId = "t-1"` and
  `externalId = "sub-42"`
- **WHEN** `UpsertUserFromClaimCommand({ tenantId: "t-1", externalId: "sub-42", email: null })`
  is dispatched
- **THEN** a new `User` row is created with `email = null`
- **AND** `displayName` is set to `"sub-42"` (the externalId)

#### Scenario: Existing user, same email

- **GIVEN** a `User` row exists for `tenantId = "t-1"`, `externalId = "sub-42"`,
  `email = "a@example.com"`, `displayName = "Alice"`
- **WHEN** `UpsertUserFromClaimCommand({ tenantId: "t-1", externalId: "sub-42", email: "a@example.com" })`
  is dispatched again
- **THEN** no new row is created
- **AND** `displayName` remains `"Alice"` (untouched)

#### Scenario: Existing user, email changed at the IdP

- **GIVEN** a `User` row exists for `tenantId = "t-1"`, `externalId = "sub-42"`,
  `email = "old@example.com"`, `displayName = "Alice"`
- **WHEN** `UpsertUserFromClaimCommand({ tenantId: "t-1", externalId: "sub-42", email: "new@example.com" })`
  is dispatched
- **THEN** the row's `email` is updated to `"new@example.com"`
- **AND** `displayName` remains `"Alice"` (untouched — only `email` re-syncs)

#### Scenario: Same externalId, different tenant

- **GIVEN** a `User` row exists for `tenantId = "t-1"`, `externalId = "sub-42"`
- **WHEN** `UpsertUserFromClaimCommand({ tenantId: "t-2", externalId: "sub-42", email: "a@example.com" })`
  is dispatched
- **THEN** a second, independent `User` row is created for `tenantId = "t-2"`
- **AND** the `t-1` row is unaffected

### Requirement: Tenant-scoped external id uniqueness

The `users` table MUST enforce a unique constraint on
`(tenant_id, external_id)`, so a race between two concurrent upserts for
the same tenant + externalId cannot produce two `User` rows.

#### Scenario: Concurrent upsert for the same tenant + externalId

- **GIVEN** two requests both trigger
  `UpsertUserFromClaimCommand({ tenantId: "t-1", externalId: "sub-42", ... })`
  at approximately the same time, before either has committed
- **WHEN** both commands run
- **THEN** exactly one `User` row for `(tenantId: "t-1", externalId: "sub-42")`
  MUST exist afterward, enforced by the database's unique constraint

### Requirement: Update own display name

`UpdateUserProfileCommand` MUST update the `displayName` of the `User`
identified by `(tenantId, externalId)`, creating the row first (via the
same find-or-create path as the upsert command) if it does not exist yet —
a caller MUST be able to set their display name on their very first
request, without a prior `GET` having created the row. `displayName` is
always present in the command input and always applied — there is no
"leave it as-is" case for this field.

#### Scenario: Update display name for an existing user

- **GIVEN** a `User` row exists for `tenantId = "t-1"`, `externalId = "sub-42"`,
  `displayName = "Alice"`
- **WHEN** `UpdateUserProfileCommand({ tenantId: "t-1", externalId: "sub-42", email: "a@example.com", displayName: "Alicia" })`
  is dispatched
- **THEN** the row's `displayName` becomes `"Alicia"`
- **AND** no new row is created

#### Scenario: Update display name for a user that doesn't exist yet

- **GIVEN** no `User` row exists for `tenantId = "t-1"`, `externalId = "sub-42"`
- **WHEN** `UpdateUserProfileCommand({ tenantId: "t-1", externalId: "sub-42", email: "a@example.com", displayName: "Alicia" })`
  is dispatched
- **THEN** a new `User` row is created for that `tenantId`/`externalId`
- **AND** its `displayName` is `"Alicia"` (not the default derived from `email`)

#### Scenario: Display name rejected when blank

- **GIVEN** a `User` row exists for `tenantId = "t-1"`, `externalId = "sub-42"`
- **WHEN** `UpdateUserProfileCommand` is dispatched with `displayName: ""`
- **THEN** the command MUST be rejected by `UserDisplayNameValueObject`'s
  validation before any write is attempted

### Requirement: Update own avatarUrl (three-state)

`UpdateUserProfileCommand`'s `avatarUrl` input MUST be treated as a
three-state field, distinct from `displayName`: omitting it from the
command input MUST leave the `User`'s stored `avatarUrl` unchanged,
supplying `null` MUST clear it, and supplying a URL string MUST set it.

#### Scenario: avatarUrl omitted from the command

- **GIVEN** a `User` row exists for `tenantId = "t-1"`, `externalId = "sub-42"`,
  `avatarUrl = "https://example.com/old.png"`
- **WHEN** `UpdateUserProfileCommand` is dispatched with `displayName`
  set and no `avatarUrl` key at all
- **THEN** the row's `avatarUrl` remains `"https://example.com/old.png"`

#### Scenario: avatarUrl set to a new value

- **GIVEN** a `User` row exists for `tenantId = "t-1"`, `externalId = "sub-42"`
- **WHEN** `UpdateUserProfileCommand` is dispatched with
  `avatarUrl: "https://example.com/new.png"`
- **THEN** the row's `avatarUrl` becomes `"https://example.com/new.png"`

#### Scenario: avatarUrl cleared with an explicit null

- **GIVEN** a `User` row exists for `tenantId = "t-1"`, `externalId = "sub-42"`,
  `avatarUrl = "https://example.com/old.png"`
- **WHEN** `UpdateUserProfileCommand` is dispatched with `avatarUrl: null`
- **THEN** the row's `avatarUrl` becomes `null`

#### Scenario: New user created via PATCH defaults avatarUrl to null

- **GIVEN** no `User` row exists for `tenantId = "t-1"`, `externalId = "sub-42"`
- **WHEN** `UpdateUserProfileCommand` is dispatched with `displayName`
  set and no `avatarUrl` key
- **THEN** the newly created row's `avatarUrl` is `null` (the creation
  default — omitting the key on this first-ever call still means
  "untouched", i.e. left at its default, not derived from anything)

### Requirement: Update own locale (three-state)

`UpdateUserProfileCommand`'s `locale` input MUST be treated as a
three-state field, the same contract as `avatarUrl`: omitting it from the
command input MUST leave the `User`'s stored `locale` unchanged, supplying
`null` MUST clear it, and supplying a locale string MUST set it.

#### Scenario: locale omitted from the command

- **GIVEN** a `User` row exists for `tenantId = "t-1"`, `externalId = "sub-42"`,
  `locale = "en-US"`
- **WHEN** `UpdateUserProfileCommand` is dispatched with `displayName`
  set and no `locale` key at all
- **THEN** the row's `locale` remains `"en-US"`

#### Scenario: locale set to a new value

- **GIVEN** a `User` row exists for `tenantId = "t-1"`, `externalId = "sub-42"`
- **WHEN** `UpdateUserProfileCommand` is dispatched with `locale: "es-ES"`
- **THEN** the row's `locale` becomes `"es-ES"`

#### Scenario: locale cleared with an explicit null

- **GIVEN** a `User` row exists for `tenantId = "t-1"`, `externalId = "sub-42"`,
  `locale = "en-US"`
- **WHEN** `UpdateUserProfileCommand` is dispatched with `locale: null`
- **THEN** the row's `locale` becomes `null`

#### Scenario: New user created via PATCH defaults locale to null

- **GIVEN** no `User` row exists for `tenantId = "t-1"`, `externalId = "sub-42"`
- **WHEN** `UpdateUserProfileCommand` is dispatched with `displayName`
  set and no `locale` key
- **THEN** the newly created row's `locale` is `null`

### Requirement: Update own timezone (three-state)

`UpdateUserProfileCommand`'s `timezone` input MUST be treated as a
three-state field, the same contract as `avatarUrl`: omitting it from the
command input MUST leave the `User`'s stored `timezone` unchanged,
supplying `null` MUST clear it, and supplying a timezone string MUST set
it.

#### Scenario: timezone omitted from the command

- **GIVEN** a `User` row exists for `tenantId = "t-1"`, `externalId = "sub-42"`,
  `timezone = "America/New_York"`
- **WHEN** `UpdateUserProfileCommand` is dispatched with `displayName`
  set and no `timezone` key at all
- **THEN** the row's `timezone` remains `"America/New_York"`

#### Scenario: timezone set to a new value

- **GIVEN** a `User` row exists for `tenantId = "t-1"`, `externalId = "sub-42"`
- **WHEN** `UpdateUserProfileCommand` is dispatched with
  `timezone: "Europe/Madrid"`
- **THEN** the row's `timezone` becomes `"Europe/Madrid"`

#### Scenario: timezone cleared with an explicit null

- **GIVEN** a `User` row exists for `tenantId = "t-1"`, `externalId = "sub-42"`,
  `timezone = "America/New_York"`
- **WHEN** `UpdateUserProfileCommand` is dispatched with `timezone: null`
- **THEN** the row's `timezone` becomes `null`

#### Scenario: New user created via PATCH defaults timezone to null

- **GIVEN** no `User` row exists for `tenantId = "t-1"`, `externalId = "sub-42"`
- **WHEN** `UpdateUserProfileCommand` is dispatched with `displayName`
  set and no `timezone` key
- **THEN** the newly created row's `timezone` is `null`
