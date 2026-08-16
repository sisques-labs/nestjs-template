import { Injectable } from '@nestjs/common';

import { PaymentAggregate } from '@contexts/payments/domain/aggregates/payment.aggregate';
import { PaymentBuilder } from '@contexts/payments/domain/builders/payment.builder';
import { CurrencyEnum } from '@contexts/payments/domain/enums/currency.enum';
import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { PaymentStatusEnum } from '@contexts/payments/domain/enums/payment-status.enum';
import { PaymentViewModel } from '@contexts/payments/domain/view-models/payment.view-model';

import { PaymentTypeOrmEntity } from '../entities/payment.entity';

@Injectable()
export class PaymentTypeOrmMapper {
  constructor(private readonly builder: PaymentBuilder) {}

  public toDomain(entity: PaymentTypeOrmEntity): PaymentAggregate {
    return this.hydrate(entity).build();
  }

  public toViewModel(entity: PaymentTypeOrmEntity): PaymentViewModel {
    return this.hydrate(entity).buildViewModel();
  }

  public toPersistence(aggregate: PaymentAggregate): PaymentTypeOrmEntity {
    const primitives = aggregate.toPrimitives();
    const entity = new PaymentTypeOrmEntity();
    entity.id = primitives.id;
    entity.provider = primitives.provider;
    entity.providerPaymentId = primitives.providerPaymentId ?? null;
    entity.customerId = primitives.customerId;
    entity.amount = primitives.amount;
    entity.currency = primitives.currency;
    entity.status = primitives.status;
    entity.idempotencyKey = primitives.idempotencyKey;
    entity.refundedAmount = primitives.refundedAmount;
    entity.description = primitives.description ?? null;
    entity.metadata = primitives.metadata ?? null;
    entity.createdAt = primitives.createdAt;
    entity.updatedAt = primitives.updatedAt;
    return entity;
  }

  private hydrate(entity: PaymentTypeOrmEntity): PaymentBuilder {
    return this.builder
      .withId(entity.id)
      .withProvider(entity.provider as PaymentProviderEnum)
      .withProviderPaymentId(entity.providerPaymentId ?? undefined)
      .withCustomerId(entity.customerId)
      .withAmount(entity.amount)
      .withCurrency(entity.currency as CurrencyEnum)
      .withStatus(entity.status as PaymentStatusEnum)
      .withIdempotencyKey(entity.idempotencyKey)
      .withRefundedAmount(entity.refundedAmount)
      .withDescription(entity.description ?? undefined)
      .withMetadata(entity.metadata ?? undefined)
      .withCreatedAt(entity.createdAt)
      .withUpdatedAt(entity.updatedAt);
  }
}
