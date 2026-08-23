import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UpdateUserDisplayNameHandler } from '@contexts/users/application/commands/update-user-display-name/update-user-display-name.handler';
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

const COMMAND_HANDLERS = [
  UpsertUserFromClaimHandler,
  UpdateUserDisplayNameHandler,
];
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
// openspec/changes/add-users-context/design.md decision 5.
const USERS_REST_ENABLED =
  Boolean(process.env.IDENTITY_PROVIDER) &&
  process.env.TENANCY_ENABLED === 'true';

/**
 * This template's second bounded context. Its domain/application/
 * infrastructure providers register unconditionally — harmless, mirrors
 * `TenantModule` — but `UsersController` (the piece with the hard guard
 * dependency) is opt-in, see `USERS_REST_ENABLED` above.
 */
@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([...INFRASTRUCTURE_ENTITIES])],
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
