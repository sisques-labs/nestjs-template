import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BaseDatabaseRepository,
  Criteria,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';
import { Repository } from 'typeorm';

import { SubscriptionAggregate } from '@contexts/payments/domain/aggregates/subscription.aggregate';
import { ISubscriptionWriteRepository } from '@contexts/payments/domain/repositories/write/subscription-write.repository';

import { SubscriptionTypeOrmEntity } from '../entities/subscription.entity';
import { SubscriptionTypeOrmMapper } from '../mappers/subscription-typeorm.mapper';

@Injectable()
export class SubscriptionTypeOrmWriteRepository
  extends BaseDatabaseRepository
  implements ISubscriptionWriteRepository
{
  constructor(
    @InjectRepository(SubscriptionTypeOrmEntity)
    private readonly repository: Repository<SubscriptionTypeOrmEntity>,
    private readonly mapper: SubscriptionTypeOrmMapper,
  ) {
    super();
  }

  async save(aggregate: SubscriptionAggregate): Promise<SubscriptionAggregate> {
    const entity = this.mapper.toPersistence(aggregate);
    const saved = await this.repository.save(entity);
    return this.mapper.toDomain(saved);
  }

  async findById(id: string): Promise<SubscriptionAggregate | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByIdempotencyKey(
    provider: string,
    idempotencyKey: string,
  ): Promise<SubscriptionAggregate | null> {
    const entity = await this.repository.findOne({
      where: { provider, idempotencyKey },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByProviderSubscriptionId(
    providerSubscriptionId: string,
  ): Promise<SubscriptionAggregate | null> {
    const entity = await this.repository.findOne({
      where: { providerSubscriptionId },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByCriteria(
    _criteria: Criteria,
  ): Promise<PaginatedResult<SubscriptionAggregate>> {
    const [entities, total] = await this.repository.findAndCount();
    const items = entities.map((entity) => this.mapper.toDomain(entity));
    return new PaginatedResult(items, total, 1, total || 1);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
