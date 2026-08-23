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

/**
 * This template's second bounded context. No `controllers` yet — the
 * `/users/me` REST surface is added in a later layer, gated behind
 * `IDENTITY_PROVIDER && TENANCY_ENABLED` (see
 * `openspec/changes/add-users-context/design.md` decision 5): unlike
 * `TenantModule`, this context's controller will depend on `IdentityGuard`/
 * `TenantGuard`, so registering it unconditionally would break app boot for
 * any service with neither flag set. The providers below have no such
 * dependency and register unconditionally, same as `TenantModule` today.
 */
@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([...INFRASTRUCTURE_ENTITIES])],
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
