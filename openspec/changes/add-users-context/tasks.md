# Tasks: add-users-context

Depends on `add-core-identity-module` and `add-tenant-context` landing
first (`IPrincipal`, `IdentityGuard`, `@CurrentUser()`, `TenantGuard`,
`TenantContextService`, `TenantScopedRepository`). Stacked on top of the
tip of the tenant stack (`claude/tenant-t5-tests-docs`).

Four layers this time, not five — see `design.md`'s split rationale: there
is no new `core/` module to build (unlike `tenancy`), so what would have
been "guard" and "scoped-repo-base" layers collapse into one
application+infrastructure layer, and everything ships from
`src/contexts/users/` alone.

## 1. `users` bounded context — domain

- [ ] 1.1 `UserPrimitives` (extends `BasePrimitives`), `IUser` interface,
      `UserTenantIdValueObject` (extends `UuidValueObject` — this
      context's own reference to a `Tenant`, not an import of `tenant`'s
      `TenantIdValueObject`; see the cross-context boundary rule in
      `openspec/config.yaml`), `UserExternalIdValueObject` (extends
      `StringValueObject`, non-empty), `UserEmailValueObject` (extends
      `StringValueObject`, format-validated — constructed only when the
      claim's email is non-null; the aggregate's `email` field type is
      `UserEmailValueObject | null`), `UserDisplayNameValueObject`
      (extends `StringValueObject`, non-empty, reasonable max length).
- [ ] 1.2 `UserAggregate` (extends `BaseAggregate<UserPrimitives>`):
      constructor = hydration only; `create()` emits `UserCreatedEvent`;
      `rename(displayName: UserDisplayNameValueObject)` and
      `syncEmail(email: UserEmailValueObject | null)` as the only other
      mutating methods (no event emission — see `user-profile` spec, only
      creation is a domain event). Unit tests (manual instantiation).
- [ ] 1.3 `UserBuilder` (extends `BaseBuilder`), `UserCreatedEvent`,
      `UserViewModel` (extends `BaseViewModel`).
- [ ] 1.4 `IUserReadRepository` / `IUserWriteRepository` interfaces + DI
      tokens (Symbols). Write port adds
      `findByExternalId(tenantId: UserTenantIdValueObject, externalId: UserExternalIdValueObject)`.
- [ ] 1.5 `UserNotFoundException` (extends `BaseException`) — for the
      (currently theoretical, no by-id lookup in v1) case a future query
      needs it; document why it's included now if unused.

## 2. `users` bounded context — application + infrastructure

- [ ] 2.1 `FindOrCreateUserByExternalIdService` (mirrors
      `find-or-create-tenant-by-external-id.service.ts`): given
      `tenantId`/`externalId`/`email`, finds or creates the `UserAggregate`,
      re-syncing `email` on every call regardless of branch (see
      `user-profile` spec's email-resync requirement). Unit tests covering
      create / find-unchanged / find-with-email-change.
- [ ] 2.2 `UpsertUserFromClaimCommand` + handler: delegates to the service
      above, publishes events only when created, returns `UserViewModel`.
      Unit tests (create branch, idempotent branch).
- [ ] 2.3 `UpdateUserDisplayNameCommand` + handler: delegates to the same
      service for find-or-create, then calls `user.rename(...)`, persists,
      returns `UserViewModel`. Unit tests (existing user, user created on
      first PATCH, per `user-profile` spec).
- [ ] 2.4 `user.entity.ts` (TypeORM, `users` table: `id`, `tenant_id`,
      `external_id`, `email` nullable, `display_name`, timestamps; unique
      index on `(tenant_id, external_id)`; FK `tenant_id -> tenants.id`),
      `user-typeorm.mapper.ts`,
      `user-typeorm-{read,write}.repository.ts` — both extend/wrap via
      `createTenantScopedRepository()` from `core/tenancy` (`useClass` DI).
- [ ] 2.5 Migration: create `users` table per 2.4. Add to `TEST_MIGRATIONS`
      (`test/helpers/test-data-source.ts`) and `TRUNCATE_TABLES`
      (`test/helpers/db-reset.ts`). State the forward/down plan explicitly
      in the PR per `openspec/config.yaml`'s tasks rule (new table, no
      backfill).
- [ ] 2.6 `users.module.ts`: named provider arrays
      (`COMMAND_HANDLERS`, `APPLICATION_SERVICES`, `DOMAIN_BUILDERS`,
      `INFRASTRUCTURE_REPOSITORIES`, `INFRASTRUCTURE_MAPPERS`,
      `INFRASTRUCTURE_ENTITIES`) always registered; `controllers:` array
      populated with `UsersController` **only** when
      `process.env.IDENTITY_PROVIDER && process.env.TENANCY_ENABLED` — see
      `design.md` decision 5. Register `UsersModule` in `CONTEXT_MODULES`
      (`src/contexts/contexts.module.ts`), always (mirrors `TenantModule`).
- [ ] 2.7 `src/contexts/users/README.md`.

## 3. `users` bounded context — transport (REST)

- [ ] 3.1 `UpdateUserProfileDto` (`{ displayName: string }`, class-validator:
      `@IsString() @IsNotEmpty() @MaxLength(...)`) and
      `UserProfileResponseDto` (`id`, `email`, `displayName`, `tenantId`,
      `createdAt`, `updatedAt` — no `externalId` in the response; it's an
      internal claim value, not user-facing).
- [ ] 3.2 `UsersController`: `@Controller('users')`,
      `@UseGuards(IdentityGuard, TenantGuard)
      @UseInterceptors(TenantContextInterceptor)` at the controller level
      (both routes need the same chain). `GET me()` and `PATCH me(@Body() dto)`
      read `@CurrentUser()` for `sub`/`email` and inject
      `TenantContextService` for the resolved `tenantId`
      (`.require()` — safe here, unlike inside a guard, see `design.md`
      decision 4), dispatch the two commands from section 2 via
      `CommandBus` only. Log at entry with the principal's `sub`, per
      `openspec/config.yaml`'s logging rule — never log `email` or any
      request body field beyond that.
- [ ] 3.3 Unit tests for the controller (mocked `CommandBus`,
      `TenantContextService`) and the two DTOs' validation.

## 4. Tests & docs

- [ ] 4.1 E2E test (`test/users.e2e-spec.ts`), following
      `test/tenancy.e2e-spec.ts`'s pattern: `IDENTITY_PROVIDER=oidc` +
      `TENANCY_ENABLED=true` (dummy config via the dynamic-import trick),
      mocked `IIdentityProvider`, real Postgres. Covers: `GET /users/me`
      creates on first call and is idempotent on the second; `PATCH
      /users/me` updates `displayName` and creates the row if it doesn't
      exist yet; a body attempting to set `email` is ignored; `401` with
      no token; two different tenants' `/me` calls with the same
      `sub` produce two independent `User` rows (tenant isolation, reusing
      the two-tenant pattern from `tenancy.e2e-spec.ts`); the "opt-in"
      requirement — a second app instance booted with `TENANCY_ENABLED`
      unset has no `/users` route and still boots.
- [ ] 4.2 Update root `README.md`: add a `Users` row to the features table.

## 5. Verification

- [ ] 5.1 `pnpm lint`, `tsc --noEmit`, `pnpm test`, `pnpm test:e2e` all
      pass.
- [ ] 5.2 `pnpm test:cov` meets the repo's 80% coverage threshold.
- [ ] 5.3 Confirm `pnpm migration:run` / `:revert` both work cleanly
      against the new `users` migration, including the FK to `tenants`.
- [ ] 5.4 Boot the app twice locally: once with `IDENTITY_PROVIDER`/
      `TENANCY_ENABLED` unset (confirm no `/users` route, no DI errors),
      once with both set (confirm `/users/me` works end to end against a
      real token-shaped request) — the same manual verification style
      `add-tenant-context`'s T2/T3 PRs used.
