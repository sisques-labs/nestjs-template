import { Injectable } from '@nestjs/common';

import { SubscriptionAggregate } from '@contexts/payments/domain/aggregates/subscription.aggregate';
import { SubscriptionBuilder } from '@contexts/payments/domain/builders/subscription.builder';
import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { SubscriptionStatusEnum } from '@contexts/payments/domain/enums/subscription-status.enum';
import { SubscriptionViewModel } from '@contexts/payments/domain/view-models/subscription.view-model';

import { SubscriptionTypeOrmEntity } from '../entities/subscription.entity';

@Injectable()
export class SubscriptionTypeOrmMapper {
  constructor(private readonly builder: SubscriptionBuilder) {}

  public toDomain(entity: SubscriptionTypeOrmEntity): SubscriptionAggregate {
    return this.hydrate(entity).build();
  }

  public toViewModel(entity: SubscriptionTypeOrmEntity): SubscriptionViewModel {
    return this.hydrate(entity).buildViewModel();
  }

  public toPersistence(
    aggregate: SubscriptionAggregate,
  ): SubscriptionTypeOrmEntity {
    const primitives = aggregate.toPrimitives();
    const entity = new SubscriptionTypeOrmEntity();
    entity.id = primitives.id;
    entity.provider = primitives.provider;
    entity.providerSubscriptionId = primitives.providerSubscriptionId ?? null;
    entity.providerCustomerId = primitives.providerCustomerId ?? null;
    entity.customerId = primitives.customerId;
    entity.priceId = primitives.priceId;
    entity.status = primitives.status;
    entity.currentPeriodStart = primitives.currentPeriodStart ?? null;
    entity.currentPeriodEnd = primitives.currentPeriodEnd ?? null;
    entity.cancelAtPeriodEnd = primitives.cancelAtPeriodEnd;
    entity.idempotencyKey = primitives.idempotencyKey;
    entity.metadata = primitives.metadata ?? null;
    entity.createdAt = primitives.createdAt;
    entity.updatedAt = primitives.updatedAt;
    return entity;
  }

  private hydrate(entity: SubscriptionTypeOrmEntity): SubscriptionBuilder {
    return this.builder
      .withId(entity.id)
      .withProvider(entity.provider as PaymentProviderEnum)
      .withProviderSubscriptionId(entity.providerSubscriptionId ?? undefined)
      .withProviderCustomerId(entity.providerCustomerId ?? undefined)
      .withCustomerId(entity.customerId)
      .withPriceId(entity.priceId)
      .withStatus(entity.status as SubscriptionStatusEnum)
      .withCurrentPeriodStart(entity.currentPeriodStart ?? undefined)
      .withCurrentPeriodEnd(entity.currentPeriodEnd ?? undefined)
      .withCancelAtPeriodEnd(entity.cancelAtPeriodEnd)
      .withIdempotencyKey(entity.idempotencyKey)
      .withMetadata(entity.metadata ?? undefined)
      .withCreatedAt(entity.createdAt)
      .withUpdatedAt(entity.updatedAt);
  }
}
