# user-self-service-api

## ADDED Requirements

### Requirement: Users REST surface is opt-in

`UsersController` MUST be registered only when both `IDENTITY_PROVIDER`
and `TENANCY_ENABLED` are set. When either is unset, `/users/me` MUST NOT
exist and the application MUST still boot successfully — a service that
enables neither identity nor tenancy MUST be unaffected by this change
existing in the codebase.

#### Scenario: Neither identity nor tenancy enabled

- **GIVEN** `IDENTITY_PROVIDER` and `TENANCY_ENABLED` are both unset
- **WHEN** the application boots
- **THEN** startup MUST succeed
- **AND** no route under `/users` MUST be registered

#### Scenario: Identity enabled, tenancy not

- **GIVEN** `IDENTITY_PROVIDER` is set and `TENANCY_ENABLED` is unset
- **WHEN** the application boots
- **THEN** startup MUST succeed (per `add-tenant-context`, tenancy already
  requires identity, not the reverse)
- **AND** no route under `/users` MUST be registered

#### Scenario: Both identity and tenancy enabled

- **GIVEN** `IDENTITY_PROVIDER` and `TENANCY_ENABLED` are both set
- **WHEN** the application boots
- **THEN** `GET /users/me` and `PATCH /users/me` MUST be registered

### Requirement: GET /users/me returns the caller's own profile

`GET /users/me` MUST require a valid bearer token and a resolved tenant
(the same `IdentityGuard` + `TenantGuard` + `TenantContextInterceptor`
chain `add-tenant-context` established), resolve-or-create the caller's
`User` row for the request's tenant, and return it. There is no by-id
lookup — a caller can never request another user's profile through this
endpoint.

#### Scenario: First request for this principal

- **GIVEN** a valid bearer token resolving to `IPrincipal { sub: "sub-42", email: "a@example.com", tenantIds: ["tenant-1"] }`
- **AND** no `User` row exists yet for this tenant + `sub-42`
- **WHEN** `GET /users/me` is called
- **THEN** the response is `200` with the newly created profile
  (`displayName` defaulted per `user-profile`'s upsert requirement,
  `avatarUrl: null`, `locale: null`, `timezone: null`)

#### Scenario: Subsequent request for the same principal

- **GIVEN** a `User` row already exists for this tenant + `sub-42`
- **WHEN** `GET /users/me` is called again
- **THEN** the response is `200` with the existing profile, unchanged

#### Scenario: No bearer token

- **GIVEN** the request carries no `Authorization` header
- **WHEN** `GET /users/me` is called
- **THEN** the response is `401` (`IdentityGuard`)

### Requirement: PATCH /users/me updates displayName and/or avatarUrl/locale/timezone

`PATCH /users/me` MUST accept a required `displayName` field and optional
`avatarUrl`/`locale`/`timezone` fields, updating only those on the
caller's own `User` row. `email`, `externalId`, and `tenantId` MUST NOT be
settable through this endpoint — they are derived exclusively from the
verified token and the resolved tenant.

#### Scenario: Update own display name

- **GIVEN** a valid bearer token resolving to a principal with an existing
  `User` row
- **WHEN** `PATCH /users/me` is called with `{ "displayName": "Alicia" }`
- **THEN** the response is `200` with `displayName: "Alicia"`
- **AND** the row's `email`/`externalId`/`tenantId` are unchanged
- **AND** the row's `avatarUrl` is unchanged — the key was omitted, not
  sent as `null`

#### Scenario: Set avatarUrl

- **GIVEN** a valid bearer token resolving to a principal with an existing
  `User` row
- **WHEN** `PATCH /users/me` is called with
  `{ "displayName": "Alicia", "avatarUrl": "https://example.com/a.png" }`
- **THEN** the response is `200` with `avatarUrl: "https://example.com/a.png"`

#### Scenario: Clear avatarUrl with an explicit null

- **GIVEN** a valid bearer token resolving to a principal with an existing
  `User` row whose `avatarUrl` is currently set
- **WHEN** `PATCH /users/me` is called with
  `{ "displayName": "Alicia", "avatarUrl": null }`
- **THEN** the response is `200` with `avatarUrl: null`

#### Scenario: Reject a non-URL avatarUrl

- **GIVEN** a valid bearer token
- **WHEN** `PATCH /users/me` is called with
  `{ "displayName": "Alicia", "avatarUrl": "not-a-url" }`
- **THEN** the response is `400`, and no write occurs

#### Scenario: Set locale

- **GIVEN** a valid bearer token resolving to a principal with an existing
  `User` row
- **WHEN** `PATCH /users/me` is called with
  `{ "displayName": "Alicia", "locale": "en-US" }`
- **THEN** the response is `200` with `locale: "en-US"`

#### Scenario: Clear locale with an explicit null

- **GIVEN** a valid bearer token resolving to a principal with an existing
  `User` row whose `locale` is currently set
- **WHEN** `PATCH /users/me` is called with
  `{ "displayName": "Alicia", "locale": null }`
- **THEN** the response is `200` with `locale: null`

#### Scenario: Reject a non-locale-shaped locale

- **GIVEN** a valid bearer token
- **WHEN** `PATCH /users/me` is called with
  `{ "displayName": "Alicia", "locale": "!!!" }`
- **THEN** the response is `400`, and no write occurs

#### Scenario: Set timezone

- **GIVEN** a valid bearer token resolving to a principal with an existing
  `User` row
- **WHEN** `PATCH /users/me` is called with
  `{ "displayName": "Alicia", "timezone": "Europe/Madrid" }`
- **THEN** the response is `200` with `timezone: "Europe/Madrid"`

#### Scenario: Clear timezone with an explicit null

- **GIVEN** a valid bearer token resolving to a principal with an existing
  `User` row whose `timezone` is currently set
- **WHEN** `PATCH /users/me` is called with
  `{ "displayName": "Alicia", "timezone": null }`
- **THEN** the response is `200` with `timezone: null`

#### Scenario: Reject a non-timezone-shaped timezone

- **GIVEN** a valid bearer token
- **WHEN** `PATCH /users/me` is called with
  `{ "displayName": "Alicia", "timezone": "not-a-timezone" }`
- **THEN** the response is `400`, and no write occurs

#### Scenario: Attempt to set email via the request body

- **GIVEN** a valid bearer token
- **WHEN** `PATCH /users/me` is called with
  `{ "displayName": "Alicia", "email": "attacker@example.com" }`
- **THEN** the response is `400` — the app's global `ValidationPipe`
  (`whitelist: true, forbidNonWhitelisted: true`, see `main.ts`) rejects
  any request body property not declared on `UpdateUserProfileDto` before
  the request reaches the controller
- **AND** no write occurs and the stored `email` is unaffected

#### Scenario: Blank display name

- **GIVEN** a valid bearer token
- **WHEN** `PATCH /users/me` is called with `{ "displayName": "" }`
- **THEN** the response is `400`, and no write occurs
