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

const COMMAND_HANDLERS = [UpsertUserFromClaimHandler, UpdateUserProfileHandler];
const APPLICATION_SERVICES = [FindOrCreateUserByExternalIdService];
const DOMAIN_BUILDERS = [UserBuilder];
const INFRASTRUCTURE_REPOSITORIES = [
  { provide: USER_READ_REPOSITORY, useClass: UserTypeOrmReadRepository },
  { provide: USER_WRITE_REPOSITORY, useClass: UserTypeOrmWriteRepository },
];
const INFRASTRUCTURE_MAPPERS = [UserTypeOrmMapper];
const INFRASTRUCTURE_ENTITIES = [UserEntity];

/**
 * This template's second bounded context. No `controllers` yet — the
 * `/users/me` REST surface is added in a later layer, gated behind
 * `IDENTITY_PROVIDER && TENANCY_ENABLED` (see
 * `openspec/changes/add-users-context/design.md` decision 6): unlike
 * `TenantModule`, this context's controller will depend on `IdentityGuard`/
 * `TenantGuard`, so registering it unconditionally would break app boot for
 * any service with neither flag set.
 *
 * `TenancyModule` is imported directly here, unconditionally — NOT gated
 * behind `TENANCY_ENABLED`. `UserTypeOrmReadRepository` (see
 * `INFRASTRUCTURE_REPOSITORIES` below) injects `TenantContextService` via
 * `createTenantScopedRepository()`, and that provider only exists in the
 * DI graph when `TenancyModule` has been imported somewhere. `CoreModule`
 * only imports it when `TENANCY_ENABLED=true` — so without this explicit
 * import here, `UsersModule`'s own providers (registered unconditionally,
 * see below) would fail to resolve at boot for any service that sets
 * `IDENTITY_PROVIDER` without also setting `TENANCY_ENABLED` (confirmed by
 * a real `Nest can't resolve dependencies of UserTypeOrmReadRepository`
 * E2E failure before this import was added). `TenancyModule`'s own
 * providers (`TenantContextService`, `TenantGuard`, `TenantContextInterceptor`)
 * have no external dependency risk of their own — nothing in them needs a
 * real identity/tenancy configuration to construct — so importing it here
 * unconditionally is safe; Nest de-dupes the module instance if
 * `CoreModule` also imports it (same class reference). This makes
 * `INFRASTRUCTURE_REPOSITORIES`'s original "harmless to always register"
 * claim actually true.
 */
@Module({
  imports: [
    CqrsModule,
    TenancyModule,
    TypeOrmModule.forFeature([...INFRASTRUCTURE_ENTITIES]),
  ],
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
