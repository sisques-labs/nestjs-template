import { EventBus } from '@nestjs/cqrs';

import { IPaymentProviderPort } from '@contexts/payments/application/ports/payment-provider.port';
import { SubscriptionAggregate } from '@contexts/payments/domain/aggregates/subscription.aggregate';
import { SubscriptionBuilder } from '@contexts/payments/domain/builders/subscription.builder';
import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { SubscriptionStatusEnum } from '@contexts/payments/domain/enums/subscription-status.enum';
import { ISubscriptionWriteRepository } from '@contexts/payments/domain/repositories/write/subscription-write.repository';

import { CreateSubscriptionCommand } from './create-subscription.command';
import { CreateSubscriptionCommandHandler } from './create-subscription.handler';

describe('CreateSubscriptionCommandHandler', () => {
  let handler: CreateSubscriptionCommandHandler;
  let mockWriteRepo: jest.Mocked<ISubscriptionWriteRepository>;
  let mockPort: jest.Mocked<IPaymentProviderPort>;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    mockWriteRepo = {
      save: jest.fn().mockImplementation((agg) => Promise.resolve(agg)),
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      delete: jest.fn(),
      findByIdempotencyKey: jest.fn().mockResolvedValue(null),
      findByProviderSubscriptionId: jest.fn(),
    };

    mockPort = {
      providerName: PaymentProviderEnum.STRIPE,
      createPaymentIntent: jest.fn(),
      refundPayment: jest.fn(),
      createSubscription: jest.fn().mockResolvedValue({
        providerSubscriptionId: 'sub_123',
        providerCustomerId: 'cus_123',
        status: SubscriptionStatusEnum.ACTIVE,
      }),
      cancelSubscription: jest.fn(),
      verifyWebhookSignature: jest.fn(),
    };

    mockEventBus = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    } as unknown as jest.Mocked<EventBus>;

    handler = new CreateSubscriptionCommandHandler(
      mockWriteRepo,
      mockPort,
      new SubscriptionBuilder(),
      mockEventBus,
    );
  });

  function buildCommand(idempotencyKey = 'idem-1'): CreateSubscriptionCommand {
    return new CreateSubscriptionCommand({
      customerId: 'cus_123',
      priceId: 'price_pro',
      idempotencyKey,
    });
  }

  it('calls the port once and persists the subscription', async () => {
    const result = await handler.execute(buildCommand());

    expect(mockPort.createSubscription).toHaveBeenCalledTimes(1);
    expect(mockWriteRepo.save).toHaveBeenCalledTimes(1);
    expect(result.subscriptionId).toHaveLength(36);
  });

  it('does not call the port on an idempotent retry', async () => {
    mockWriteRepo.findByIdempotencyKey.mockResolvedValue({
      id: 'existing-id',
    } as unknown as SubscriptionAggregate);

    const result = await handler.execute(buildCommand());

    expect(mockPort.createSubscription).not.toHaveBeenCalled();
    expect(result.subscriptionId).toBe('existing-id');
  });
});
