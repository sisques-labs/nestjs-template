import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BaseDatabaseRepository,
  Criteria,
  PaginatedResult,
  SortDirection,
} from '@sisques-labs/nestjs-kit';
import { applyCriteriaToQueryBuilder } from '@sisques-labs/nestjs-kit/typeorm';
import { Repository } from 'typeorm';

import { TenantContextService } from '@core/tenancy/application/services/tenant-context.service';
import { createTenantScopedRepository } from '@core/tenancy/infrastructure/persistence/typeorm/create-tenant-scoped-repository.factory';

import { IUserReadRepository } from '@contexts/users/domain/repositories/read/user-read.repository';
import { UserViewModel } from '@contexts/users/domain/view-models/user.view-model';
import { UserEntity } from '@contexts/users/infrastructure/persistence/typeorm/entities/user.entity';
import { UserTypeOrmMapper } from '@contexts/users/infrastructure/persistence/typeorm/mappers/user-typeorm.mapper';

const ALIAS = 'user';

/**
 * `IUserReadRepository` implementation. This context's `users` table has a
 * `tenant_id` column, so — unlike `tenant`'s own repositories — this is the
 * first real consumer of `createTenantScopedRepository()` (see
 * `src/core/tenancy/README.md`, "How a future context uses it").
 *
 * `findByCriteria`'s `createQueryBuilder()` call bypasses the scoping
 * proxy (documented on the factory itself), so the tenant filter is
 * applied explicitly via `.andWhere(...)` here, reading
 * `TenantContextService.require()` directly rather than through the
 * wrapped repository.
 */
@Injectable()
export class UserTypeOrmReadRepository
  extends BaseDatabaseRepository
  implements IUserReadRepository
{
  private readonly repository: Repository<UserEntity>;

  constructor(
    @InjectRepository(UserEntity)
    rawRepository: Repository<UserEntity>,
    private readonly mapper: UserTypeOrmMapper,
    private readonly tenantContextService: TenantContextService,
  ) {
    super();
    this.logger = new Logger(UserTypeOrmReadRepository.name);
    this.repository = createTenantScopedRepository(
      rawRepository,
      tenantContextService,
    );
  }

  async findById(id: string): Promise<UserViewModel | null> {
    this.logger.debug(`Finding User by id ${id}`);
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toViewModel(entity) : null;
  }

  async findByCriteria(
    criteria: Criteria,
  ): Promise<PaginatedResult<UserViewModel>> {
    this.logger.debug('Finding Users by criteria');
    const { page, limit, skip } = await this.calculatePagination(criteria);

    const [entities, total] = await applyCriteriaToQueryBuilder(
      this.repository
        .createQueryBuilder(ALIAS)
        .andWhere(`${ALIAS}.tenantId = :tenantId`, {
          tenantId: this.tenantContextService.require(),
        }),
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

  async save(_viewModel: UserViewModel): Promise<void> {
    // read-side projection — write side handles persistence
  }

  async delete(_id: string): Promise<void> {
    // read-side projection — write side handles persistence
  }
}
