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

import { IPaymentReadRepository } from '@contexts/payments/domain/repositories/read/payment-read.repository';
import { PaymentViewModel } from '@contexts/payments/domain/view-models/payment.view-model';

import { PaymentTypeOrmEntity } from '../entities/payment.entity';
import { PaymentTypeOrmMapper } from '../mappers/payment-typeorm.mapper';

const ALIAS = 'payment';

@Injectable()
export class PaymentTypeOrmReadRepository
  extends BaseDatabaseRepository
  implements IPaymentReadRepository
{
  constructor(
    @InjectRepository(PaymentTypeOrmEntity)
    private readonly repository: Repository<PaymentTypeOrmEntity>,
    private readonly mapper: PaymentTypeOrmMapper,
  ) {
    super();
  }

  async findById(id: string): Promise<PaymentViewModel | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toViewModel(entity) : null;
  }

  async findByCriteria(
    criteria: Criteria,
  ): Promise<PaginatedResult<PaymentViewModel>> {
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

  async save(_viewModel: PaymentViewModel): Promise<void> {}

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
