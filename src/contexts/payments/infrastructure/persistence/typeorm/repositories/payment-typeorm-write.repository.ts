import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BaseDatabaseRepository,
  Criteria,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';
import { Repository } from 'typeorm';

import { PaymentAggregate } from '@contexts/payments/domain/aggregates/payment.aggregate';
import { IPaymentWriteRepository } from '@contexts/payments/domain/repositories/write/payment-write.repository';

import { PaymentTypeOrmEntity } from '../entities/payment.entity';
import { PaymentTypeOrmMapper } from '../mappers/payment-typeorm.mapper';

@Injectable()
export class PaymentTypeOrmWriteRepository
  extends BaseDatabaseRepository
  implements IPaymentWriteRepository
{
  constructor(
    @InjectRepository(PaymentTypeOrmEntity)
    private readonly repository: Repository<PaymentTypeOrmEntity>,
    private readonly mapper: PaymentTypeOrmMapper,
  ) {
    super();
  }

  async save(aggregate: PaymentAggregate): Promise<PaymentAggregate> {
    const entity = this.mapper.toPersistence(aggregate);
    const saved = await this.repository.save(entity);
    return this.mapper.toDomain(saved);
  }

  async findById(id: string): Promise<PaymentAggregate | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByIdempotencyKey(
    provider: string,
    idempotencyKey: string,
  ): Promise<PaymentAggregate | null> {
    const entity = await this.repository.findOne({
      where: { provider, idempotencyKey },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByProviderPaymentId(
    providerPaymentId: string,
  ): Promise<PaymentAggregate | null> {
    const entity = await this.repository.findOne({
      where: { providerPaymentId },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByCriteria(
    _criteria: Criteria,
  ): Promise<PaginatedResult<PaymentAggregate>> {
    const [entities, total] = await this.repository.findAndCount();
    const items = entities.map((entity) => this.mapper.toDomain(entity));
    return new PaginatedResult(items, total, 1, total || 1);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
