import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BaseDatabaseRepository,
  Criteria,
  PaginatedResult,
  SortDirection,
} from '@sisques-labs/nestjs-kit';
import { applyCriteriaToQueryBuilder } from '@sisques-labs/nestjs-kit/typeorm';
import { Repository } from 'typeorm';

import { ITenantReadRepository } from '@contexts/tenant/domain/repositories/read/tenant-read.repository';
import { TenantViewModel } from '@contexts/tenant/domain/view-models/tenant.view-model';
import { TenantEntity } from '@contexts/tenant/infrastructure/persistence/typeorm/entities/tenant.entity';
import { TenantTypeOrmMapper } from '@contexts/tenant/infrastructure/persistence/typeorm/mappers/tenant-typeorm.mapper';

const ALIAS = 'tenant';

/**
 * `ITenantReadRepository` implementation. See
 * `tenant-typeorm-write.repository.ts` for why this composes an
 * `@InjectRepository`-supplied `Repository<TenantEntity>` instead of
 * extending `BaseTypeormMasterRepository`.
 */
@Injectable()
export class TenantTypeOrmReadRepository
  extends BaseDatabaseRepository
  implements ITenantReadRepository
{
  constructor(
    @InjectRepository(TenantEntity)
    private readonly repository: Repository<TenantEntity>,
    private readonly mapper: TenantTypeOrmMapper,
  ) {
    super();
  }

  async findById(id: string): Promise<TenantViewModel | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toViewModel(entity) : null;
  }

  async findByCriteria(
    criteria: Criteria,
  ): Promise<PaginatedResult<TenantViewModel>> {
    const { page, limit, skip } = await this.calculatePagination(criteria);

    const [entities, total] = await applyCriteriaToQueryBuilder(
      this.repository.createQueryBuilder(ALIAS),
      criteria,
      {
        alias: ALIAS,
        defaultSort: { field: 'createdAt', direction: SortDirection.DESC },
      },
    )
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return new PaginatedResult(
      entities.map((entity) => this.mapper.toViewModel(entity)),
      total,
      page,
      limit,
    );
  }

  async save(viewModel: TenantViewModel): Promise<void> {
    await this.repository.save({
      id: viewModel.id,
      externalId: viewModel.externalId,
      createdAt: viewModel.createdAt,
      updatedAt: viewModel.updatedAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
