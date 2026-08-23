import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TenancyModule } from '@core/tenancy/tenancy.module';

import { UpdateUserProfileHandler } from '@contexts/users/application/commands/update-user-profile/update-user-profile.handler';
import { UpsertUserFromClaimHandler } from '@contexts/users/application/commands/upsert-user-from-claim/upsert-user-from-claim.handler';
import { FindOrCreateUserByExternalIdService } from '@contexts/users/application/services/write/find-or-create-user-by-external-id.service';
import { UserBuilder } from '@contexts/users/domain/builders/user.builder';
import { USER_READ_REPOSITORY } from '@contexts/users/domain/repositories/read/user-read.repository';
import { USER_WRITE_REPOSITORY } from '@contexts/users/domain/repositories/write/user-write.repository';
import { UserEntity } from '@contexts/users/infrastructure/persistence/typeorm/entities/user.entity';
import { UserTypeOrmMapper } from '@contexts/users/infrastructure/persistence/typeorm/mappers/user-typeorm.mapper';
import { UserTypeOrmReadRepository } from '@contexts/users/infrastructure/persistence/typeorm/repositories/user-typeorm-read.repository';
import { UserTypeOrmWriteRepository } from '@contexts/users/infrastructure/persistence/typeorm/repositories/user-typeorm-write.repository';
import { UsersController } from '@contexts/users/transport/rest/users.controller';

const COMMAND_HANDLERS = [UpsertUserFromClaimHandler, UpdateUserProfileHandler];
const APPLICATION_SERVICES = [FindOrCreateUserByExternalIdService];
const DOMAIN_BUILDERS = [UserBuilder];
const INFRASTRUCTURE_REPOSITORIES = [
  { provide: USER_READ_REPOSITORY, useClass: UserTypeOrmReadRepository },
  { provide: USER_WRITE_REPOSITORY, useClass: UserTypeOrmWriteRepository },
];
const INFRASTRUCTURE_MAPPERS = [UserTypeOrmMapper];
const INFRASTRUCTURE_ENTITIES = [UserEntity];

// `UsersController` depends on `IdentityGuard`/`TenantGuard`, which Nest
// resolves at module-graph-build time regardless of whether a route is
// ever called — those guards' own dependencies (IIdentityProvider,
// CommandBus) are only provided when IdentityModule/TenancyModule are
// themselves imported into CoreModule (see core.module.ts), which only
// happens when these same two flags are set. Registering the controller
// unconditionally would break boot for any service with neither flag set,
// even one that never asked for identity, tenancy, or users — see
// openspec/changes/add-users-context/design.md decision 6.
const USERS_REST_ENABLED =
  Boolean(process.env.IDENTITY_PROVIDER) &&
  process.env.TENANCY_ENABLED === 'true';

/**
 * This template's second bounded context. Its domain/application/
 * infrastructure providers register unconditionally — harmless, mirrors
 * `TenantModule` — but `UsersController` (the piece with the hard guard
 * dependency) is opt-in, see `USERS_REST_ENABLED` above.
 *
 * `TenancyModule` is imported directly here, unconditionally — NOT gated
 * behind `TENANCY_ENABLED`. `UserTypeOrmReadRepository` (see
 * `INFRASTRUCTURE_REPOSITORIES` below) injects `TenantContextService` via
 * `createTenantScopedRepository()`, and that provider only exists in the
 * DI graph when `TenancyModule` has been imported somewhere. `CoreModule`
 * only imports it when `TENANCY_ENABLED=true` — so without this explicit
 * import here, `UsersModule`'s own providers (registered unconditionally)
 * would fail to resolve at boot for any service that sets
 * `IDENTITY_PROVIDER` without also setting `TENANCY_ENABLED` (confirmed by
 * a real `Nest can't resolve dependencies of UserTypeOrmReadRepository`
 * E2E failure before this import was added). `TenancyModule`'s own
 * providers (`TenantContextService`, `TenantGuard`, `TenantContextInterceptor`)
 * have no external dependency risk of their own — nothing in them needs a
 * real identity/tenancy configuration to construct — so importing it here
 * unconditionally is safe; Nest de-dupes the module instance if
 * `CoreModule` also imports it (same class reference). This makes the
 * "harmless to always register" claim above actually true.
 */
@Module({
  imports: [
    CqrsModule,
    TenancyModule,
    TypeOrmModule.forFeature([...INFRASTRUCTURE_ENTITIES]),
  ],
  controllers: USERS_REST_ENABLED ? [UsersController] : [],
  providers: [
    ...COMMAND_HANDLERS,
    ...APPLICATION_SERVICES,
    ...DOMAIN_BUILDERS,
    ...INFRASTRUCTURE_REPOSITORIES,
    ...INFRASTRUCTURE_MAPPERS,
  ],
  exports: [],
})
export class UsersModule {}
