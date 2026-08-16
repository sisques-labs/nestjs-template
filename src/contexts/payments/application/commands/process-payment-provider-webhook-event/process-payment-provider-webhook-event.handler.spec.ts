import {
  DateValueObject,
  NumberValueObject,
  StringValueObject,
} from '@sisques-labs/nestjs-kit';
import { EventBus } from '@nestjs/cqrs';

import { PaymentProviderWebhookEvent } from '@contexts/payments/application/ports/payment-provider-webhook-event.interface';
import { IPaymentProviderPort } from '@contexts/payments/application/ports/payment-provider.port';
import { PaymentAggregate } from '@contexts/payments/domain/aggregates/payment.aggregate';
import { CurrencyEnum } from '@contexts/payments/domain/enums/currency.enum';
import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { PaymentStatusEnum } from '@contexts/payments/domain/enums/payment-status.enum';
import { InvalidWebhookSignatureException } from '@contexts/payments/domain/exceptions/invalid-webhook-signature.exception';
import { IWebhookEventLogRepository } from '@contexts/payments/domain/repositories/webhook-event-log.repository';
import { IPaymentWriteRepository } from '@contexts/payments/domain/repositories/write/payment-write.repository';
import { ISubscriptionWriteRepository } from '@contexts/payments/domain/repositories/write/subscription-write.repository';
import { CurrencyValueObject } from '@contexts/payments/domain/value-objects/currency/currency.value-object';
import { IdempotencyKeyValueObject } from '@contexts/payments/domain/value-objects/idempotency-key/idempotency-key.value-object';
import { PaymentAmountValueObject } from '@contexts/payments/domain/value-objects/payment-amount/payment-amount.value-object';
import { PaymentIdValueObject } from '@contexts/payments/domain/value-objects/payment-id/payment-id.value-object';
import { PaymentProviderValueObject } from '@contexts/payments/domain/value-objects/payment-provider/payment-provider.value-object';
import { PaymentStatusValueObject } from '@contexts/payments/domain/value-objects/payment-status/payment-status.value-object';

import { ProcessPaymentProviderWebhookEventCommand } from './process-payment-provider-webhook-event.command';
import { ProcessPaymentProviderWebhookEventCommandHandler } from './process-payment-provider-webhook-event.handler';

function buildPayment(): PaymentAggregate {
  const now = new Date();
  return new PaymentAggregate({
    id: new PaymentIdValueObject('660e8400-e29b-41d4-a716-446655440001'),
    provider: new PaymentProviderValueObject(PaymentProviderEnum.STRIPE),
    providerPaymentId: new StringValueObject('pi_123'),
    customerId: new StringValueObject('cus_123'),
    amount: new PaymentAmountValueObject(1000),
    currency: new CurrencyValueObject(CurrencyEnum.USD),
    status: new PaymentStatusValueObject(PaymentStatusEnum.PENDING),
    idempotencyKey: new IdempotencyKeyValueObject('idem-1'),
    refundedAmount: new NumberValueObject(0, { min: 0, allowDecimals: false }),
    createdAt: new DateValueObject(now),
    updatedAt: new DateValueObject(now),
  });
}

describe('ProcessPaymentProviderWebhookEventCommandHandler', () => {
  let handler: ProcessPaymentProviderWebhookEventCommandHandler;
  let mockPort: jest.Mocked<IPaymentProviderPort>;
  let mockWebhookLog: jest.Mocked<IWebhookEventLogRepository>;
  let mockPaymentWriteRepo: jest.Mocked<IPaymentWriteRepository>;
  let mockSubscriptionWriteRepo: jest.Mocked<ISubscriptionWriteRepository>;
  let mockEventBus: jest.Mocked<EventBus>;

  function normalizedEvent(
    overrides: Partial<PaymentProviderWebhookEvent> = {},
  ): PaymentProviderWebhookEvent {
    return {
      providerEventId: 'evt_1',
      type: 'payment_succeeded',
      providerPaymentId: 'pi_123',
      ...overrides,
    };
  }

  beforeEach(() => {
    mockPort = {
      providerName: PaymentProviderEnum.STRIPE,
      createPaymentIntent: jest.fn(),
      refundPayment: jest.fn(),
      createSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      verifyWebhookSignature: jest.fn().mockReturnValue(normalizedEvent()),
    };

    mockWebhookLog = {
      hasProcessed: jest.fn().mockResolvedValue(false),
      markProcessed: jest.fn().mockResolvedValue(undefined),
    };

    mockPaymentWriteRepo = {
      save: jest.fn().mockImplementation((agg) => Promise.resolve(agg)),
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      delete: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      findByProviderPaymentId: jest.fn().mockResolvedValue(buildPayment()),
    };

    mockSubscriptionWriteRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      delete: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      findByProviderSubscriptionId: jest.fn(),
    };

    mockEventBus = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    } as unknown as jest.Mocked<EventBus>;

    handler = new ProcessPaymentProviderWebhookEventCommandHandler(
      mockPort,
      mockWebhookLog,
      mockPaymentWriteRepo,
      mockSubscriptionWriteRepo,
      mockEventBus,
    );
  });

  function buildCommand(): ProcessPaymentProviderWebhookEventCommand {
    return new ProcessPaymentProviderWebhookEventCommand({
      rawBody: Buffer.from('{}'),
      signature: 'sig_test',
    });
  }

  it('throws InvalidWebhookSignatureException before touching any repository', async () => {
    mockPort.verifyWebhookSignature.mockImplementation(() => {
      throw new Error('bad signature');
    });

    await expect(handler.execute(buildCommand())).rejects.toThrow(
      InvalidWebhookSignatureException,
    );
    expect(mockWebhookLog.hasProcessed).not.toHaveBeenCalled();
    expect(mockPaymentWriteRepo.findByProviderPaymentId).not.toHaveBeenCalled();
  });

  it('is a no-op when the event was already processed', async () => {
    mockWebhookLog.hasProcessed.mockResolvedValue(true);

    await handler.execute(buildCommand());

    expect(mockPaymentWriteRepo.findByProviderPaymentId).not.toHaveBeenCalled();
    expect(mockWebhookLog.markProcessed).not.toHaveBeenCalled();
  });

  it('payment_succeeded marks the payment succeeded and records the event as processed', async () => {
    await handler.execute(buildCommand());

    expect(mockPaymentWriteRepo.save).toHaveBeenCalledTimes(1);
    const saved = mockPaymentWriteRepo.save.mock
      .calls[0][0] as PaymentAggregate;
    expect(saved.status).toBe(PaymentStatusEnum.SUCCEEDED);
    expect(mockWebhookLog.markProcessed).toHaveBeenCalledWith(
      PaymentProviderEnum.STRIPE,
      'evt_1',
    );
  });

  it('payment_failed marks the payment failed', async () => {
    mockPort.verifyWebhookSignature.mockReturnValue(
      normalizedEvent({ type: 'payment_failed' }),
    );

    await handler.execute(buildCommand());

    const saved = mockPaymentWriteRepo.save.mock
      .calls[0][0] as PaymentAggregate;
    expect(saved.status).toBe(PaymentStatusEnum.FAILED);
  });

  it('is a no-op when no payment matches the providerPaymentId, but still records the event', async () => {
    mockPaymentWriteRepo.findByProviderPaymentId.mockResolvedValue(null);

    await handler.execute(buildCommand());

    expect(mockPaymentWriteRepo.save).not.toHaveBeenCalled();
    expect(mockWebhookLog.markProcessed).toHaveBeenCalled();
  });
});
