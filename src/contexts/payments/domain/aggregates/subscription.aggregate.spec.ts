import {
  BooleanValueObject,
  DateValueObject,
  StringValueObject,
} from '@sisques-labs/nestjs-kit';

import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { SubscriptionStatusEnum } from '@contexts/payments/domain/enums/subscription-status.enum';
import { IdempotencyKeyValueObject } from '@contexts/payments/domain/value-objects/idempotency-key/idempotency-key.value-object';
import { PaymentProviderValueObject } from '@contexts/payments/domain/value-objects/payment-provider/payment-provider.value-object';
import { SubscriptionIdValueObject } from '@contexts/payments/domain/value-objects/subscription-id/subscription-id.value-object';
import { SubscriptionStatusValueObject } from '@contexts/payments/domain/value-objects/subscription-status/subscription-status.value-object';

import { SubscriptionAggregate } from './subscription.aggregate';

const SUBSCRIPTION_ID = '770e8400-e29b-41d4-a716-446655440002';

function buildSubscription(
  status: SubscriptionStatusEnum = SubscriptionStatusEnum.ACTIVE,
): SubscriptionAggregate {
  const now = new Date();
  return new SubscriptionAggregate({
    id: new SubscriptionIdValueObject(SUBSCRIPTION_ID),
    provider: new PaymentProviderValueObject(PaymentProviderEnum.STRIPE),
    providerSubscriptionId: new StringValueObject('sub_123'),
    providerCustomerId: new StringValueObject('cus_123'),
    customerId: new StringValueObject('cus_123'),
    priceId: new StringValueObject('price_pro'),
    status: new SubscriptionStatusValueObject(status),
    cancelAtPeriodEnd: new BooleanValueObject(false),
    idempotencyKey: new IdempotencyKeyValueObject('idem-1'),
    createdAt: new DateValueObject(now),
    updatedAt: new DateValueObject(now),
  });
}

describe('SubscriptionAggregate', () => {
  it('create() emits SubscriptionCreated', () => {
    const subscription = buildSubscription();
    subscription.create();

    const events = subscription.getUncommittedEvents();
    expect(events).toHaveLength(1);
    expect(events[0].constructor.name).toBe('SubscriptionCreatedEvent');
  });

  describe('syncStatus()', () => {
    it('updates status and emits SubscriptionStatusChanged when the status differs', () => {
      const subscription = buildSubscription(SubscriptionStatusEnum.TRIALING);
      subscription.syncStatus(SubscriptionStatusEnum.ACTIVE);

      expect(subscription.status).toBe(SubscriptionStatusEnum.ACTIVE);
      const events = subscription.getUncommittedEvents();
      expect(events[events.length - 1].constructor.name).toBe(
        'SubscriptionStatusChangedEvent',
      );
    });

    it('is a no-op (no event) when the status is unchanged', () => {
      const subscription = buildSubscription(SubscriptionStatusEnum.ACTIVE);
      subscription.syncStatus(SubscriptionStatusEnum.ACTIVE);

      expect(subscription.getUncommittedEvents()).toHaveLength(0);
    });

    it('updates the current period even when the status is unchanged', () => {
      const subscription = buildSubscription(SubscriptionStatusEnum.ACTIVE);
      const periodEnd = new Date('2026-09-01T00:00:00.000Z');
      subscription.syncStatus(
        SubscriptionStatusEnum.ACTIVE,
        undefined,
        periodEnd,
      );

      expect(subscription.toPrimitives().currentPeriodEnd).toEqual(periodEnd);
    });
  });

  it('cancel() sets cancelAtPeriodEnd and emits SubscriptionCanceled without changing status', () => {
    const subscription = buildSubscription(SubscriptionStatusEnum.ACTIVE);
    subscription.cancel(true);

    const primitives = subscription.toPrimitives();
    expect(primitives.cancelAtPeriodEnd).toBe(true);
    expect(primitives.status).toBe(SubscriptionStatusEnum.ACTIVE);
    const events = subscription.getUncommittedEvents();
    expect(events[events.length - 1].constructor.name).toBe(
      'SubscriptionCanceledEvent',
    );
  });
});
