# identity-bridge

## ADDED Requirements

### Requirement: Provider selection

The system MUST resolve exactly one active `IIdentityProvider` adapter at
application boot, chosen by the `IDENTITY_PROVIDER` environment variable
(`cognito` | `supabase` | `oidc`). The system MUST fail fast at boot,
before accepting any request, when `IDENTITY_PROVIDER` is set to an
unsupported value or when the selected provider's required configuration is
incomplete.

#### Scenario: Valid provider configured

- **GIVEN** `IDENTITY_PROVIDER=cognito` and all `COGNITO_*` env vars are set
- **WHEN** the application boots
- **THEN** the `IIdentityProvider` DI token resolves to the Cognito adapter

#### Scenario: Provider selected but missing required config

- **GIVEN** `IDENTITY_PROVIDER=supabase` and `SUPABASE_JWT_SECRET` is unset
- **WHEN** the application boots
- **THEN** startup MUST fail with a validation error naming the missing
  variable, before the HTTP server starts listening

#### Scenario: Unsupported provider value

- **GIVEN** `IDENTITY_PROVIDER=okta`
- **WHEN** the application boots
- **THEN** startup MUST fail with a validation error listing the supported
  values (`cognito`, `supabase`, `oidc`)

#### Scenario: Provider not configured

- **GIVEN** `IDENTITY_PROVIDER` is unset
- **WHEN** the application boots
- **THEN** the identity module MUST NOT register `IdentityGuard`/`RolesGuard`
  globally and the application MUST start exactly as it does without this
  module

### Requirement: Token verification

`IdentityGuard` MUST verify the `Authorization: Bearer <token>` header of an
incoming request against the active provider's signing keys and MUST reject
the request when the token is missing, malformed, expired, or fails
signature verification.

#### Scenario: Valid token

- **GIVEN** a request carries a valid, unexpired access token issued by the
  active provider
- **WHEN** `IdentityGuard` processes the request
- **THEN** the request is allowed and a normalized `IPrincipal` is attached
  to it

#### Scenario: Expired token

- **GIVEN** a request carries an expired access token
- **WHEN** `IdentityGuard` processes the request
- **THEN** the guard MUST reject the request with `401 Unauthorized`

#### Scenario: Missing Authorization header

- **GIVEN** a request carries no `Authorization` header
- **WHEN** `IdentityGuard` processes the request
- **THEN** the guard MUST reject the request with `401 Unauthorized`

### Requirement: Principal normalization

`IIdentityProvider.verifyToken()` MUST return an `IPrincipal` with a
provider-agnostic shape (`sub`, `email`, `roles`, `tenantIds`) regardless of
which adapter is active, translating each provider's raw claim shape via
that provider's own claims mapper. `tenantIds` MUST be every tenant the
verified token proves the principal belongs to (an empty array when the
token carries no tenant claim) — a principal MAY belong to more than one
tenant.

#### Scenario: Cognito claims mapped to IPrincipal

- **GIVEN** the active provider is Cognito and a verified token carries a
  `cognito:groups` claim
- **WHEN** `verifyToken()` returns
- **THEN** `IPrincipal.roles` MUST contain the `Role` values corresponding
  to those groups

#### Scenario: Supabase claims mapped to IPrincipal

- **GIVEN** the active provider is Supabase and a verified token carries
  `app_metadata.roles`
- **WHEN** `verifyToken()` returns
- **THEN** `IPrincipal.roles` MUST contain the `Role` values corresponding
  to those roles

### Requirement: Role-based authorization

`RolesGuard`, combined with the `@Roles()` decorator, MUST reject a request
when the resolved `IPrincipal.roles` does not intersect the roles required
by the handler.

#### Scenario: Principal has a required role

- **GIVEN** a handler is decorated with `@Roles(Role.ADMIN)`
- **AND** the request's `IPrincipal.roles` includes `Role.ADMIN`
- **WHEN** `RolesGuard` processes the request
- **THEN** the request is allowed

#### Scenario: Principal lacks the required role

- **GIVEN** a handler is decorated with `@Roles(Role.ADMIN)`
- **AND** the request's `IPrincipal.roles` does not include `Role.ADMIN`
- **WHEN** `RolesGuard` processes the request
- **THEN** the guard MUST reject the request with `403 Forbidden`

### Requirement: Backend-proxied login

`POST /auth/login` MUST forward submitted credentials to the active
provider's authentication API and return a normalized `ITokenSet` on
success. The system MUST NOT log or persist the raw password at any point
in this flow.

#### Scenario: Valid credentials

- **GIVEN** a request body with a valid email/password pair for the active
  provider
- **WHEN** `POST /auth/login` is called
- **THEN** the response is `200 OK` with `accessToken`, `refreshToken`, and
  `expiresIn`

#### Scenario: Invalid credentials

- **GIVEN** a request body with an incorrect password
- **WHEN** `POST /auth/login` is called
- **THEN** the response MUST be `401 Unauthorized` and the response body
  MUST NOT echo the submitted password

### Requirement: Token refresh

`POST /auth/refresh` MUST exchange a valid refresh token for a new
`ITokenSet` via the active provider.

#### Scenario: Valid refresh token

- **GIVEN** a request body with a refresh token issued by the active
  provider and not yet expired or revoked
- **WHEN** `POST /auth/refresh` is called
- **THEN** the response is `200 OK` with a new `ITokenSet`

#### Scenario: Invalid or expired refresh token

- **GIVEN** a request body with an expired or revoked refresh token
- **WHEN** `POST /auth/refresh` is called
- **THEN** the response MUST be `401 Unauthorized`

### Requirement: Provider-delegated user management

`createUser`, `disableUser`, `deleteUser`, `updateUserAttributes`, and
`resetPassword` on `IIdentityProvider` MUST delegate to the active
provider's administrative API and MUST NOT persist any local copy of user
data.

#### Scenario: Create user delegates to provider admin API

- **GIVEN** the active provider is Cognito
- **WHEN** `createUser({ email, attributes })` is called
- **THEN** the adapter MUST call the Cognito admin create-user API and
  return the provider's resulting user identifier, without writing to
  Postgres or any other local store

#### Scenario: Operation against a non-existent user

- **GIVEN** a user identifier that does not exist at the active provider
- **WHEN** `disableUser(id)` is called
- **THEN** the adapter MUST surface a not-found error without retrying
  silently or fabricating success

### Requirement: MCP context integration

The MCP `contextBuilder` MUST attach the resolved `IPrincipal` to
`IMcpToolContext` when the incoming MCP request carries a valid bearer
token, using the same `IIdentityProvider.verifyToken()` path as
`IdentityGuard`.

#### Scenario: MCP request with a valid token

- **GIVEN** an MCP request carries a valid `Authorization: Bearer <token>`
  header
- **WHEN** the `contextBuilder` runs
- **THEN** `IMcpToolContext` MUST include the resolved `IPrincipal`

#### Scenario: MCP request without a token

- **GIVEN** an MCP request carries no `Authorization` header
- **WHEN** the `contextBuilder` runs
- **THEN** `IMcpToolContext` MUST be built without a principal (no
  rejection at the context-builder level; individual tools remain
  responsible for requiring one, which is out of scope for this change)
