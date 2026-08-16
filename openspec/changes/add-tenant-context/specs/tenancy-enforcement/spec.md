# tenancy-enforcement

## ADDED Requirements

### Requirement: Tenancy configuration validity

The system MUST fail fast at boot when `TENANCY_ENABLED=true` is set
without `IDENTITY_PROVIDER` also being set, since `TenantGuard` has no
`IPrincipal` to read a tenant claim from otherwise.

#### Scenario: Tenancy enabled without an identity provider

- **GIVEN** `TENANCY_ENABLED=true` and `IDENTITY_PROVIDER` is unset
- **WHEN** the application boots
- **THEN** startup MUST fail with a validation error naming the
  dependency on `IDENTITY_PROVIDER`

#### Scenario: Tenancy disabled

- **GIVEN** `TENANCY_ENABLED` is unset
- **WHEN** the application boots
- **THEN** `TenancyModule` MUST NOT be imported and `TenantGuard` MUST NOT
  be registered anywhere — behavior is identical to a service that never
  added this change

### Requirement: Tenant resolution on a guarded request

`TenantGuard`, applied after `IdentityGuard`, MUST resolve the current
request's tenant from the attached `IPrincipal.tenantIds` — optionally
narrowed by an `X-Tenant-Id` request header when the principal belongs to
more than one tenant — upsert the corresponding `Tenant` via
`UpsertTenantFromClaimCommand`, and make the result available to the rest
of the request through `TenantContextService`.

The `X-Tenant-Id` header, when present, MUST be validated against
`IPrincipal.tenantIds` before being used — it is client-supplied input and
only ever *selects among* tenants the verified token already proves
membership in; it MUST NEVER grant access to a tenant absent from
`tenantIds`.

#### Scenario: Principal carries exactly one tenant claim, no header sent

- **GIVEN** `IdentityGuard` has attached an `IPrincipal` with
  `tenantIds = ["tenant-42"]` to the request
- **AND** the request carries no `X-Tenant-Id` header
- **WHEN** `TenantGuard` processes the request
- **THEN** the request is allowed
- **AND** `TenantContextService.get()` returns the resolved `Tenant`'s
  internal id (for external id `"tenant-42"`) for the remainder of that
  request

#### Scenario: Principal carries no tenant claim

- **GIVEN** `IdentityGuard` has attached an `IPrincipal` with
  `tenantIds = []` to the request
- **WHEN** `TenantGuard` processes the request
- **THEN** the guard MUST reject the request with `403 Forbidden` rather
  than allowing it through with no tenant scope

#### Scenario: TenantGuard runs without a principal attached

- **GIVEN** `TenantGuard` runs on a request with no `IPrincipal` attached
  (e.g. `IdentityGuard` was omitted from the guard chain by mistake)
- **WHEN** `TenantGuard` processes the request
- **THEN** the guard MUST reject the request with `403 Forbidden`

#### Scenario: X-Tenant-Id header selects among multiple valid tenants

- **GIVEN** `IdentityGuard` has attached an `IPrincipal` with
  `tenantIds = ["tenant-1", "tenant-2"]` to the request
- **AND** the request carries an `X-Tenant-Id: tenant-2` header
- **WHEN** `TenantGuard` processes the request
- **THEN** the request is allowed
- **AND** `TenantContextService.get()` returns the internal id resolved for
  external id `"tenant-2"` specifically, not `"tenant-1"`

#### Scenario: X-Tenant-Id header value not in the principal's tenants

- **GIVEN** `IdentityGuard` has attached an `IPrincipal` with
  `tenantIds = ["tenant-1", "tenant-2"]` to the request
- **AND** the request carries an `X-Tenant-Id: tenant-99` header, a tenant
  the principal is not a member of
- **WHEN** `TenantGuard` processes the request
- **THEN** the guard MUST reject the request with `403 Forbidden`
- **AND** `UpsertTenantFromClaimCommand` MUST NOT be dispatched for
  `"tenant-99"`

#### Scenario: Multiple tenants, no header (ambiguous)

- **GIVEN** `IdentityGuard` has attached an `IPrincipal` with
  `tenantIds = ["tenant-1", "tenant-2"]` to the request
- **AND** the request carries no `X-Tenant-Id` header
- **WHEN** `TenantGuard` processes the request
- **THEN** the guard MUST reject the request with `403 Forbidden` rather
  than guessing which of the principal's tenants the request meant

### Requirement: Repository-level tenant scoping

`TenantScopedRepository` MUST add a `tenant_id` filter matching the
current request's resolved tenant to every query it builds, sourced from
`TenantContextService`, and MUST throw rather than execute an unscoped
query when no tenant context is present.

#### Scenario: Query within a guarded request

- **GIVEN** `TenantContextService` currently holds `tenantId = "t-1"`
- **WHEN** a repository extending `TenantScopedRepository` executes a
  query
- **THEN** the generated SQL MUST include `tenant_id = 't-1'`

#### Scenario: Query with no tenant context present

- **GIVEN** `TenantContextService.get()` returns nothing (e.g. called
  from a background job outside any guarded request)
- **WHEN** a repository extending `TenantScopedRepository` executes a
  query
- **THEN** the repository MUST throw an error rather than execute an
  unscoped query that could return every tenant's rows
