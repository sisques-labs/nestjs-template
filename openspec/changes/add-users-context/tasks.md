# Tasks: add-users-context

Depends on `add-core-identity-module` and `add-tenant-context` landing
first (`IPrincipal`, `IdentityGuard`, `@CurrentUser()`, `TenantGuard`,
`TenantContextService`, `createTenantScopedRepository()`). Stacked on top
of the tip of the tenant stack (`claude/tenant-t5-tests-docs`).

Four layers this time, not five — see `design.md`'s split rationale: there
is no new `core/` module to build (unlike `tenancy`), so what would have
been "guard" and "scoped-repo-base" layers collapse into one
application+infrastructure layer, and everything ships from
`src/contexts/users/` alone.

**Revision**: `avatarUrl` was added to the aggregate and both `/users/me`
verbs after the four PRs below first landed, following up on the
originally-scoped `displayName`-only version — see `design.md` decisions
2–3 for the field's defaulting/three-state-PATCH rationale. `locale` and
`timezone` were added the same way, as a second follow-up on top of that —
see `design.md` decisions 7–8 for their three-state-PATCH treatment and
the local `UserLocaleValueObject`/`TimezoneValueObject` construction
workaround for a bug in `@sisques-labs/nestjs-kit`'s `LocaleValueObject`.
Task descriptions below reflect the fields as actually implemented, not
the original `displayName`-only plan.

## 1. `users` bounded context — domain

- [x] 1.1 `UserPrimitives` (extends `BasePrimitives`), `IUser` interface,
      `UserIdValueObject` / `UserTenantIdValueObject` (both extend
      `UuidValueObject` — `UserTenantIdValueObject` is this context's own
      reference to a `Tenant`, not an import of `tenant`'s
      `TenantIdValueObject`; see the cross-context boundary rule in
      `openspec/config.yaml`), `UserExternalIdValueObject` (extends
      `StringValueObject`, non-empty), `UserDisplayNameValueObject`
      (extends `StringValueObject`, non-empty, reasonable max length),
      `UserLocaleValueObject` (extends `StringValueObject`, loose
      language[-region] pattern — a local subclass rather than
      nestjs-kit's `LocaleValueObject`, which has a verified bug
      rejecting every region-qualified locale tag; see `design.md`
      decision 8). `email`/`avatarUrl`/`timezone` use nestjs-kit's
      `EmailValueObject`/`UrlValueObject`/`TimezoneValueObject` directly
      (no local subclass needed) — all are nullable fields on the
      aggregate, not nullable VOs; `TimezoneValueObject` is constructed
      with `{ validateExistence: false }` (decision 8).
- [x] 1.2 `UserAggregate` (extends `BaseAggregate<UserPrimitives>`):
      constructor = hydration only; `create()` emits `UserCreatedEvent`;
      `rename(displayName: UserDisplayNameValueObject)`,
      `syncEmail(email: EmailValueObject | null)`,
      `updateAvatarUrl(avatarUrl: UrlValueObject | null)`,
      `updateLocale(locale: UserLocaleValueObject | null)`, and
      `updateTimezone(timezone: TimezoneValueObject | null)` as the only
      other mutating methods (no event emission — see `user-profile`
      spec, only creation is a domain event). Unit tests (manual
      instantiation).
- [x] 1.3 `UserBuilder` (extends `BaseBuilder`), `UserCreatedEvent`,
      `UserViewModel` (extends `BaseViewModel`).
- [x] 1.4 `IUserReadRepository` / `IUserWriteRepository` interfaces + DI
      tokens (Symbols). Write port adds
      `findByExternalId(tenantId: UserTenantIdValueObject, externalId: UserExternalIdValueObject)`.
- [x] 1.5 `UserNotFoundException` — **dropped**, not added. v1 has no
      by-id lookup path that would ever throw it (self-service `/me`
      only), so it would have shipped as dead code; can be added back the
      moment a query needs it.

## 2. `users` bounded context — application + infrastructure

- [x] 2.1 `FindOrCreateUserByExternalIdService` (mirrors
      `find-or-create-tenant-by-external-id.service.ts`): given
      `tenantId`/`externalId`/`email`, finds or creates the `UserAggregate`.
      Re-syncs `email` only when the supplied value actually differs from
      the stored one (see `user-profile` spec's email-resync requirement)
      — an intentional refinement over "always write", to avoid a DB write
      on every single request for a returning user. New users default
      `avatarUrl`/`locale`/`timezone` to `null` explicitly (no derivation
      — there's no IdP claim for any of them). Returns the **pre-save
      in-memory aggregate**, not the write repository's `save()` return
      value — `save()` remaps the
      persisted row back through the mapper into a freshly-hydrated
      aggregate with no uncommitted events, which would otherwise silently
      make `UserCreatedEvent` unpublishable; see the service's own doc
      comment. Unit tests covering create / find-unchanged /
      find-with-email-change.
- [x] 2.2 `UpsertUserFromClaimCommand` + handler: delegates to the service
      above, publishes events only when created, returns `UserViewModel`.
      Unit tests (create branch, idempotent branch).
- [x] 2.3 `UpdateUserProfileCommand` + handler (named `-Profile`, not
      `-DisplayName` — generalized once `avatarUrl` needed a second
      editable field in the same `PATCH` body, and generalized again for
      `locale`/`timezone`): delegates to the same service for
      find-or-create, then always calls `user.rename(...)` and — only for
      each of the command's `avatarUrl`/`locale`/`timezone` keys that is
      not `undefined` — the matching `user.updateAvatarUrl(...)`/
      `updateLocale(...)`/`updateTimezone(...)`, persists, returns
      `UserViewModel`. Unit tests (existing user; user created on first
      PATCH; avatarUrl/locale/timezone each omitted/set/cleared, per
      `user-profile` spec).
- [x] 2.4 `user.entity.ts` (TypeORM, `users` table: `id`, `tenant_id`,
      `external_id`, `email` nullable, `display_name`, `avatar_url`
      nullable, `locale` nullable, `timezone` nullable, timestamps; unique
      index on `(tenant_id, external_id)`; FK `tenant_id -> tenants.id`),
      `user-typeorm.mapper.ts`, `user-typeorm-read.repository.ts` (wraps
      the injected repository via `createTenantScopedRepository()` from
      `core/tenancy` — this context's first real consumer of it) and
      `user-typeorm-write.repository.ts` (deliberately **not** wrapped —
      every write method already takes/carries `tenantId` explicitly, see
      the repository's own doc comment). Both `useClass` DI.
- [x] 2.5 Migration: create `users` table per 2.4. Add to `TEST_MIGRATIONS`
      (`test/helpers/test-data-source.ts`) and `TRUNCATE_TABLES`
      (`test/helpers/db-reset.ts`). Forward migration creates the table +
      unique index + FK; down migration drops the FK, index, then table,
      in that order — no backfill needed (new table). `avatar_url`, then
      later `locale`/`timezone`, were each added by editing this migration
      file in place (not a second migration), since it had not yet been
      applied to any real database when either field was added.
- [x] 2.6 `users.module.ts`: named provider arrays
      (`COMMAND_HANDLERS`, `APPLICATION_SERVICES`, `DOMAIN_BUILDERS`,
      `INFRASTRUCTURE_REPOSITORIES`, `INFRASTRUCTURE_MAPPERS`,
      `INFRASTRUCTURE_ENTITIES`) always registered; `controllers:` array
      populated with `UsersController` **only** when
      `process.env.IDENTITY_PROVIDER && process.env.TENANCY_ENABLED` — see
      `design.md` decision 6. Register `UsersModule` in `CONTEXT_MODULES`
      (`src/contexts/contexts.module.ts`), always (mirrors `TenantModule`).
- [x] 2.7 `src/contexts/users/README.md`.

## 3. `users` bounded context — transport (REST)

- [x] 3.1 `UpdateUserProfileDto` (`displayName: string` — required,
      `@IsString() @IsNotEmpty() @MaxLength(...)`; `avatarUrl?: string |
    null` — `@IsOptional() @IsUrl()`; `locale?: string | null` —
      `@IsOptional() @IsLocale()`; `timezone?: string | null` —
      `@IsOptional() @IsTimeZone()`, where `@IsOptional()` skips each
      format check for both `undefined` and `null`, matching the
      command's three-state contract) and `UserProfileResponseDto` (`id`,
      `email`, `displayName`, `avatarUrl`, `locale`, `timezone`,
      `tenantId`, `createdAt`, `updatedAt` — no `externalId` in the
      response; it's an internal claim value, not user-facing). Response
      DTO built via a static `fromViewModel()` mapper, not returned as a
      raw `UserViewModel` instance — that class's fields are
      private-with-getters and would otherwise serialize to JSON as
      underscore-prefixed properties.
- [x] 3.2 `UsersController`: `@Controller('users')`,
      `@UseGuards(IdentityGuard, TenantGuard)
    @UseInterceptors(TenantContextInterceptor)` at the controller level
      (both routes need the same chain). `GET me()` and `PATCH me(@Body() dto)`
      read `@CurrentUser()` for `sub`/`email` and inject
      `TenantContextService` for the resolved `tenantId`
      (`.require()` — safe here, unlike inside a guard, see `design.md`
      decision 5), dispatch the two commands from section 2 via
      `CommandBus` only, passing `dto.avatarUrl`/`dto.locale`/
      `dto.timezone` straight through unmodified (preserving the
      omitted/`null`/set distinction end to end). Log at entry with the
      principal's `sub`, per `openspec/config.yaml`'s logging rule — never
      log `email` or any request body field beyond that.
- [x] 3.3 Unit tests for the controller (mocked `CommandBus`,
      `TenantContextService`), including the three states of each of
      `avatarUrl`/`locale`/`timezone`. DTO validation is not unit-tested
      directly — no precedent for that in
      this codebase (other DTOs rely on E2E coverage through the global
      `ValidationPipe` instead); covered by the E2E spec in section 4
      instead.

## 4. Tests & docs

- [x] 4.1 E2E test (`test/users.e2e-spec.ts`), following
      `test/tenancy.e2e-spec.ts`'s pattern: `IDENTITY_PROVIDER=oidc` +
      `TENANCY_ENABLED=true` (dummy config via the dynamic-import trick),
      mocked `IIdentityProvider`, real Postgres. Covers: `GET /users/me`
      creates on first call (defaulting `avatarUrl`/`locale`/`timezone` to
      `null`) and is idempotent on the second; `PATCH /users/me` updates
      `displayName` and creates the row if it doesn't exist yet;
      `avatarUrl`/`locale`/`timezone` each set,
      left-untouched-when-omitted, cleared-via-`null`, and
      rejected-with-400-when-invalid (non-URL avatarUrl, non-locale-shaped
      locale, non-timezone-shaped timezone); a body attempting to set
      `email` is **rejected** with `400` (the app's global `ValidationPipe`
      is `forbidNonWhitelisted: true`, so this is a hard rejection, not a
      silent strip — corrected from this task's original wording); `401`
      with no token; two different tenants' `/me` calls with the same
      `sub` produce two independent `User` rows (tenant isolation, reusing
      the two-tenant pattern from `tenancy.e2e-spec.ts`); the "opt-in"
      requirement — a second app instance, rebuilt via `jest.resetModules()` + a fresh dynamic import (needed since `core.module.ts`/
      `users.module.ts` read both flags at module-_load_ time, not per
      request), booted with both flags unset, has no `/users/me` route
      (`404`) and still boots successfully. The `locale`/`timezone` test
      fixtures (which strings pass/fail `@IsLocale()`/`@IsTimeZone()`)
      were verified directly against the installed `class-validator`
      package before being written — not run against a real database in
      this sandbox (no Docker/Postgres available); same caveat as 4.1's
      original `avatarUrl` coverage.
- [x] 4.2 Update root `README.md`: add a `Users` row to the features
      table (mentioning `displayName`/`avatarUrl`/`locale`/`timezone`/
      `email`); rewrite the multi-tenancy "deliberately not included"
      bullet (which explicitly
      called out the lack of a tenant-scoped `users` context as the gap)
      and soften the auth bullet's "no local user table" claim.

## 5. Verification

- [ ] 5.1 `pnpm lint`, `tsc --noEmit`, `pnpm test`, `pnpm build` all pass
      (verified in the implementation sandbox, including after the
      `locale`/`timezone` follow-up — no local Postgres/Docker available
      there, so `pnpm test:e2e` itself could not be run for real; the E2E
      spec's logic was hand-reviewed against `tenancy.e2e-spec.ts`'s
      pattern instead). **Run `pnpm test:e2e` for real before merging this
      stack.**
- [ ] 5.2 `pnpm test:cov` meets the repo's 80% coverage threshold — not
      measured (same no-DB-available caveat doesn't block this one, but it
      wasn't run either; worth checking before merge).
- [ ] 5.3 Confirm `pnpm migration:run` / `:revert` both work cleanly
      against the `users` migration (including `avatar_url`/`locale`/
      `timezone` and the FK to `tenants`) — **not run**, no local Postgres
      available in the implementation sandbox.
- [ ] 5.4 Boot the app twice locally: once with `IDENTITY_PROVIDER`/
      `TENANCY_ENABLED` unset (confirm no `/users` route, no DI errors),
      once with both set (confirm `/users/me` works end to end against a
      real token-shaped request) — the same manual verification style
      `add-tenant-context`'s T2/T3 PRs used. **Not run** — covered
      logically by the E2E spec's two `describe` blocks (4.1), but not
      manually verified against a running instance.
