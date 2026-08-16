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

import { ISubscriptionReadRepository } from '@contexts/payments/domain/repositories/read/subscription-read.repository';
import { SubscriptionViewModel } from '@contexts/payments/domain/view-models/subscription.view-model';

import { SubscriptionTypeOrmEntity } from '../entities/subscription.entity';
import { SubscriptionTypeOrmMapper } from '../mappers/subscription-typeorm.mapper';

const ALIAS = 'subscription';

@Injectable()
export class SubscriptionTypeOrmReadRepository
  extends BaseDatabaseRepository
  implements ISubscriptionReadRepository
{
  constructor(
    @InjectRepository(SubscriptionTypeOrmEntity)
    private readonly repository: Repository<SubscriptionTypeOrmEntity>,
    private readonly mapper: SubscriptionTypeOrmMapper,
  ) {
    super();
  }

  async findById(id: string): Promise<SubscriptionViewModel | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toViewModel(entity) : null;
  }

  async findByCriteria(
    criteria: Criteria,
  ): Promise<PaginatedResult<SubscriptionViewModel>> {
    const { page, limit, skip } = await this.calculatePagination(criteria);

    const qb = this.repository.createQueryBuilder(ALIAS);
    applyCriteriaToQueryBuilder(qb, criteria, {
      alias: ALIAS,
      defaultSort: { field: 'createdAt', direction: SortDirection.DESC },
    });
    qb.skip(skip).take(limit);

    const [entities, total] = await qb.getManyAndCount();
    const items = entities.map((entity) => this.mapper.toViewModel(entity));

    return new PaginatedResult(items, total, page, limit);
  }

  async save(_viewModel: SubscriptionViewModel): Promise<void> {}

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
