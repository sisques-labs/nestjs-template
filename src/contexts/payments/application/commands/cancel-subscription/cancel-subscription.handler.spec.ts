import {
  BooleanValueObject,
  DateValueObject,
  StringValueObject,
} from '@sisques-labs/nestjs-kit';
import { EventBus } from '@nestjs/cqrs';

import { IPaymentProviderPort } from '@contexts/payments/application/ports/payment-provider.port';
import { AssertSubscriptionExistsService } from '@contexts/payments/application/services/write/assert-subscription-exists/assert-subscription-exists.service';
import { SubscriptionAggregate } from '@contexts/payments/domain/aggregates/subscription.aggregate';
import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { SubscriptionStatusEnum } from '@contexts/payments/domain/enums/subscription-status.enum';
import { SubscriptionNotFoundException } from '@contexts/payments/domain/exceptions/subscription-not-found.exception';
import { ISubscriptionWriteRepository } from '@contexts/payments/domain/repositories/write/subscription-write.repository';
import { IdempotencyKeyValueObject } from '@contexts/payments/domain/value-objects/idempotency-key/idempotency-key.value-object';
import { PaymentProviderValueObject } from '@contexts/payments/domain/value-objects/payment-provider/payment-provider.value-object';
import { SubscriptionIdValueObject } from '@contexts/payments/domain/value-objects/subscription-id/subscription-id.value-object';
import { SubscriptionStatusValueObject } from '@contexts/payments/domain/value-objects/subscription-status/subscription-status.value-object';

import { CancelSubscriptionCommand } from './cancel-subscription.command';
import { CancelSubscriptionCommandHandler } from './cancel-subscription.handler';

const SUBSCRIPTION_ID = '770e8400-e29b-41d4-a716-446655440002';

function buildSubscription(): SubscriptionAggregate {
  const now = new Date();
  return new SubscriptionAggregate({
    id: new SubscriptionIdValueObject(SUBSCRIPTION_ID),
    provider: new PaymentProviderValueObject(PaymentProviderEnum.STRIPE),
    providerSubscriptionId: new StringValueObject('sub_123'),
    customerId: new StringValueObject('cus_123'),
    priceId: new StringValueObject('price_pro'),
    status: new SubscriptionStatusValueObject(SubscriptionStatusEnum.ACTIVE),
    cancelAtPeriodEnd: new BooleanValueObject(false),
    idempotencyKey: new IdempotencyKeyValueObject('idem-1'),
    createdAt: new DateValueObject(now),
    updatedAt: new DateValueObject(now),
  });
}

describe('CancelSubscriptionCommandHandler', () => {
  let handler: CancelSubscriptionCommandHandler;
  let mockWriteRepo: jest.Mocked<ISubscriptionWriteRepository>;
  let mockPort: jest.Mocked<IPaymentProviderPort>;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    mockWriteRepo = {
      save: jest.fn().mockImplementation((agg) => Promise.resolve(agg)),
      findById: jest.fn().mockResolvedValue(buildSubscription()),
      findByCriteria: jest.fn(),
      delete: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      findByProviderSubscriptionId: jest.fn(),
    };

    mockPort = {
      providerName: PaymentProviderEnum.STRIPE,
      createPaymentIntent: jest.fn(),
      refundPayment: jest.fn(),
      createSubscription: jest.fn(),
      cancelSubscription: jest.fn().mockResolvedValue(undefined),
      verifyWebhookSignature: jest.fn(),
    };

    mockEventBus = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    } as unknown as jest.Mocked<EventBus>;

    handler = new CancelSubscriptionCommandHandler(
      new AssertSubscriptionExistsService(mockWriteRepo),
      mockWriteRepo,
      mockPort,
      mockEventBus,
    );
  });

  it('calls the port and persists cancelAtPeriodEnd', async () => {
    await handler.execute(
      new CancelSubscriptionCommand({ subscriptionId: SUBSCRIPTION_ID }),
    );

    expect(mockPort.cancelSubscription).toHaveBeenCalledWith('sub_123');
    expect(mockWriteRepo.save).toHaveBeenCalledTimes(1);
  });

  it('throws SubscriptionNotFoundException when the subscription does not exist', async () => {
    mockWriteRepo.findById.mockResolvedValue(null);

    await expect(
      handler.execute(
        new CancelSubscriptionCommand({ subscriptionId: SUBSCRIPTION_ID }),
      ),
    ).rejects.toThrow(SubscriptionNotFoundException);
  });
});
