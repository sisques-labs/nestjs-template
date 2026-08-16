import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BaseDatabaseRepository,
  Criteria,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';
import { Repository } from 'typeorm';

import { TenantAggregate } from '@contexts/tenant/domain/aggregates/tenant.aggregate';
import { ITenantWriteRepository } from '@contexts/tenant/domain/repositories/write/tenant-write.repository';
import { TenantExternalIdValueObject } from '@contexts/tenant/domain/value-objects/tenant-external-id/tenant-external-id.vo';
import { TenantEntity } from '@contexts/tenant/infrastructure/persistence/typeorm/entities/tenant.entity';
import { TenantTypeOrmMapper } from '@contexts/tenant/infrastructure/persistence/typeorm/mappers/tenant-typeorm.mapper';

/**
 * `ITenantWriteRepository` implementation.
 *
 * Composes a directly-injected `Repository<TenantEntity>` (via
 * `@InjectRepository`, backed by `autoLoadEntities: true` on the app's
 * single `@nestjs/typeorm` `DataSource` — see `core.module.ts`) rather than
 * extending `BaseTypeormMasterRepository` from
 * `@sisques-labs/nestjs-kit/typeorm`: that base class resolves its
 * repository from `TypeormMasterService`, which is only provided by the
 * kit's own `TypeOrmModule` — a separate `DataSource`-management module
 * this template does not import (`core.module.ts` wires
 * `@nestjs/typeorm`'s `TypeOrmModule.forRootAsync` directly instead).
 * Extends `BaseDatabaseRepository` only for its `logger` property —
 * `findByCriteria` is a read-side concern (see
 * `TenantTypeOrmReadRepository`), consistent with the write repositories
 * across the rest of the codebase.
 */
@Injectable()
export class TenantTypeOrmWriteRepository
  extends BaseDatabaseRepository
  implements ITenantWriteRepository
{
  constructor(
    @InjectRepository(TenantEntity)
    private readonly repository: Repository<TenantEntity>,
    private readonly mapper: TenantTypeOrmMapper,
  ) {
    super();
    this.logger = new Logger(TenantTypeOrmWriteRepository.name);
  }

  async findById(id: string): Promise<TenantAggregate | null> {
    this.logger.debug(`Finding Tenant by id ${id}`);
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toAggregate(entity) : null;
  }

  async findByExternalId(
    externalId: TenantExternalIdValueObject,
  ): Promise<TenantAggregate | null> {
    this.logger.debug(`Finding Tenant by externalId ${externalId.value}`);
    const entity = await this.repository.findOne({
      where: { externalId: externalId.value },
    });
    return entity ? this.mapper.toAggregate(entity) : null;
  }

  async findByCriteria(
    _criteria: Criteria,
  ): Promise<PaginatedResult<TenantAggregate>> {
    // criteria-based pagination is a read-side concern — see
    // TenantTypeOrmReadRepository.findByCriteria()
    throw new Error('Method not implemented.');
  }

  async save(aggregate: TenantAggregate): Promise<TenantAggregate> {
    this.logger.debug(`Saving Tenant ${aggregate.id.value}`);
    const entity = this.mapper.toPersistence(aggregate);
    const saved = await this.repository.save(entity);
    return this.mapper.toAggregate(saved);
  }

  async delete(id: string): Promise<void> {
    this.logger.debug(`Deleting Tenant ${id}`);
    await this.repository.delete(id);
  }
}
