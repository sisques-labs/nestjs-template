# Tasks: add-core-identity-module

No DB schema changes in this change — `IIdentityProvider` persists nothing
locally, so no migration plan applies to any task below.

## 1. Ports & config foundations

- [ ] 1.1 Define `IIdentityProvider` port, `IPrincipal`, `ITokenSet`,
      `ILoginCredentials`, `IUserAttributes` under
      `src/core/identity/application/ports/` (one type per file, per the
      repo's "one type per file" rule), plus the `IIdentityProvider` DI
      token (Symbol).
- [ ] 1.2 Add `Role` enum at `src/core/identity/domain/enums/role.enum.ts`.
- [ ] 1.3 Extend `src/core/config/env.validation.ts` with `IDENTITY_PROVIDER`
      (`z.enum(['cognito', 'supabase', 'oidc']).optional()`) and a
      `superRefine` fail-fast check per provider (mirroring the existing
      `KAFKA_ENABLED -> KAFKA_BROKERS` pattern): Cognito requires
      `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_REGION`;
      Supabase requires `SUPABASE_URL`, `SUPABASE_JWT_SECRET`,
      `SUPABASE_SERVICE_ROLE_KEY`; OIDC requires `OIDC_ISSUER_URL`,
      `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`.
- [ ] 1.4 Add the new env vars to `.env.example` with placeholder values and
      a comment noting they're only required when `IDENTITY_PROVIDER` is
      set.
- [ ] 1.5 Unit tests for the new `env.validation.ts` branches (co-located
      `.spec.ts`, extending the existing `env.validation.spec.ts`).

## 2. Provider adapters

- [ ] 2.1 Add `@aws-sdk/client-cognito-identity-provider`, `jose` to
      `package.json`.
- [ ] 2.2 Implement `CognitoIdentityProvider`
      (`src/core/identity/infrastructure/providers/cognito/`): `login`
      (InitiateAuth), `refreshToken`, `verifyToken` (JWKS via `jose`,
      cached), `createUser`/`disableUser`/`deleteUser`/
      `updateUserAttributes`/`resetPassword` (admin APIs). Co-located
      `cognito-claims.mapper.ts` mapping `cognito:groups` -> `Role[]`.
      Unit tests with a mocked AWS SDK client.
- [ ] 2.3 Add `@supabase/supabase-js` to `package.json`.
- [ ] 2.4 Implement `SupabaseIdentityProvider`
      (`.../providers/supabase/`): same method surface via
      `supabase.auth.signInWithPassword`, `supabase.auth.refreshSession`,
      JWT verification against `SUPABASE_JWT_SECRET`, and
      `supabase.auth.admin.*` for user management. Co-located
      `supabase-claims.mapper.ts` mapping `app_metadata.roles` -> `Role[]`.
      Unit tests with a mocked Supabase client.
- [ ] 2.5 Add `openid-client` to `package.json`.
- [ ] 2.6 Implement `OidcIdentityProvider` (`.../providers/oidc/`): discovery
      against `OIDC_ISSUER_URL`, password-grant or token-exchange login
      (document the grant type assumption in the adapter's file header),
      JWKS verification, and an admin-API stub that throws a clear
      "not supported by generic OIDC" error for user-management methods
      the standard doesn't cover (OIDC has no standard admin API — most
      concrete IdPs behind this adapter won't support `createUser`/etc.
      without a vendor-specific extension). Co-located
      `oidc-claims.mapper.ts` with a configurable role-claim name
      (`OIDC_ROLE_CLAIM`, default `roles`). Unit tests with a mocked
      `openid-client`.

## 3. Guards, decorators, REST transport

- [ ] 3.1 Implement `IdentityProviderFactory`
      (`application/services/identity-provider.factory.ts`), a `useFactory`
      provider selecting the adapter from `ConfigService.get('IDENTITY_PROVIDER')`.
- [ ] 3.2 Implement `IdentityGuard` (`infrastructure/guards/identity.guard.ts`)
      and `@CurrentUser()` (`infrastructure/decorators/current-user.decorator.ts`).
      Unit tests with `jest.Mocked<IIdentityProvider>` (no `@nestjs/testing`,
      per the architecture skill).
- [ ] 3.3 Implement `RolesGuard` and `@Roles()` decorator. Unit tests
      covering allow/deny paths.
- [ ] 3.4 Implement `AuthController`
      (`transport/rest/auth.controller.ts`) with `POST /auth/login` and
      `POST /auth/refresh`, `LoginDto`/`RefreshTokenDto` under
      `transport/rest/dtos/`, `class-validator` decorators, and entry
      logging per the repo's logging convention — logging the request but
      never the password field.
- [ ] 3.5 Implement `IdentityModule` (`identity.module.ts`) using the named
      provider-array convention (`IDENTITY_PROVIDERS`,
      `INFRASTRUCTURE_GUARDS`, `TRANSPORT_PROVIDERS`), `useClass` for any
      internal DI tokens, exporting the `IIdentityProvider` token,
      `IdentityGuard`, and `RolesGuard`.
- [ ] 3.6 Wire `IdentityModule` into `CORE_MODULES` in
      `src/core/core.module.ts`.

## 4. MCP + cross-cutting integration

- [ ] 4.1 Update `McpModule.forRoot(...)` in `src/core/core.module.ts` to
      pass a `contextBuilder` that resolves an `IPrincipal` from the
      request's bearer token (reusing `IIdentityProvider.verifyToken()`)
      and attaches it to `IMcpToolContext`, replacing the existing
      `{ requestId }`-only default. Remove the now-resolved TODO comment.
- [ ] 4.2 Confirm `base-exception.filter.ts` maps the exceptions thrown by
      `IdentityGuard`/`RolesGuard`/`AuthController` (401/403) correctly; add
      a case only if the existing filter doesn't already cover
      `UnauthorizedException`/`ForbiddenException`.

## 5. Tests & docs

- [ ] 5.1 E2E tests (`test/*.e2e-spec.ts`) for `/auth/login`, `/auth/refresh`,
      and a guarded sample route, binding a mocked `IIdentityProvider` in
      the test bootstrap (`test/helpers/app-bootstrap.ts`) instead of
      hitting a real provider.
- [ ] 5.2 Add `src/core/identity/README.md` documenting the module,
      mirroring the style of `src/core/health/` /
      `src/core/observability/` per the architecture skill's reference to
      "add one, mirroring... as new cross-cutting modules are added."
- [ ] 5.3 Update root `README.md`'s "Deliberately not included" entry: keep
      multi-tenancy listed as not included, but change the auth bullet to
      point at `src/core/identity/` as the opt-in module instead of only a
      documented extension point.

## 6. Verification

- [ ] 6.1 `pnpm lint`, `tsc --noEmit`, `pnpm test`, `pnpm test:e2e` all pass.
- [ ] 6.2 `pnpm test:cov` meets the repo's 80% coverage threshold for the
      new module.
