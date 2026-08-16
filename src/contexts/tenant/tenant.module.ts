import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UpsertTenantFromClaimHandler } from '@contexts/tenant/application/commands/upsert-tenant-from-claim/upsert-tenant-from-claim.handler';
import { FindOrCreateTenantByExternalIdService } from '@contexts/tenant/application/services/write/find-or-create-tenant-by-external-id.service';
import { TenantBuilder } from '@contexts/tenant/domain/builders/tenant.builder';
import { TENANT_READ_REPOSITORY } from '@contexts/tenant/domain/repositories/read/tenant-read.repository';
import { TENANT_WRITE_REPOSITORY } from '@contexts/tenant/domain/repositories/write/tenant-write.repository';
import { TenantEntity } from '@contexts/tenant/infrastructure/persistence/typeorm/entities/tenant.entity';
import { TenantTypeOrmMapper } from '@contexts/tenant/infrastructure/persistence/typeorm/mappers/tenant-typeorm.mapper';
import { TenantTypeOrmReadRepository } from '@contexts/tenant/infrastructure/persistence/typeorm/repositories/tenant-typeorm-read.repository';
import { TenantTypeOrmWriteRepository } from '@contexts/tenant/infrastructure/persistence/typeorm/repositories/tenant-typeorm-write.repository';

const COMMAND_HANDLERS = [UpsertTenantFromClaimHandler];
const APPLICATION_SERVICES = [FindOrCreateTenantByExternalIdService];
const DOMAIN_BUILDERS = [TenantBuilder];
const INFRASTRUCTURE_REPOSITORIES = [
  { provide: TENANT_READ_REPOSITORY, useClass: TenantTypeOrmReadRepository },
  { provide: TENANT_WRITE_REPOSITORY, useClass: TenantTypeOrmWriteRepository },
];
const INFRASTRUCTURE_MAPPERS = [TenantTypeOrmMapper];
const INFRASTRUCTURE_ENTITIES = [TenantEntity];

/**
 * This template's first bounded context. No `transport/` subtree — v1 has
 * no REST/GraphQL/MCP surface, `UpsertTenantFromClaimCommand` is invoked
 * exclusively via `CommandBus` (from `core/tenancy/`'s `TenantGuard`, in a
 * later layer). See `src/contexts/tenant/README.md`.
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
})
export class TenantModule {}
