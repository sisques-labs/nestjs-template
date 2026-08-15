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
request's tenant from the attached `IPrincipal.tenantId`, upsert the
corresponding `Tenant` via `UpsertTenantFromClaimCommand`, and make the
result available to the rest of the request through
`TenantContextService`.

#### Scenario: Principal carries a tenant claim

- **GIVEN** `IdentityGuard` has attached an `IPrincipal` with
  `tenantId = "tenant-42"` to the request
- **WHEN** `TenantGuard` processes the request
- **THEN** the request is allowed
- **AND** `TenantContextService.get()` returns the resolved `Tenant`'s
  internal id for the remainder of that request

#### Scenario: Principal carries no tenant claim

- **GIVEN** `IdentityGuard` has attached an `IPrincipal` with
  `tenantId = null` to the request
- **WHEN** `TenantGuard` processes the request
- **THEN** the guard MUST reject the request with `403 Forbidden` rather
  than allowing it through with no tenant scope

#### Scenario: TenantGuard runs without a principal attached

- **GIVEN** `TenantGuard` runs on a request with no `IPrincipal` attached
  (e.g. `IdentityGuard` was omitted from the guard chain by mistake)
- **WHEN** `TenantGuard` processes the request
- **THEN** the guard MUST reject the request with `403 Forbidden`

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
