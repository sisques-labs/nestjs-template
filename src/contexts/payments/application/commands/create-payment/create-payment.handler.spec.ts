import { EventBus } from '@nestjs/cqrs';

import { IPaymentProviderPort } from '@contexts/payments/application/ports/payment-provider.port';
import { PaymentAggregate } from '@contexts/payments/domain/aggregates/payment.aggregate';
import { PaymentBuilder } from '@contexts/payments/domain/builders/payment.builder';
import { CurrencyEnum } from '@contexts/payments/domain/enums/currency.enum';
import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { PaymentProviderException } from '@contexts/payments/domain/exceptions/payment-provider.exception';
import { IPaymentWriteRepository } from '@contexts/payments/domain/repositories/write/payment-write.repository';

import { CreatePaymentCommand } from './create-payment.command';
import { CreatePaymentCommandHandler } from './create-payment.handler';

describe('CreatePaymentCommandHandler', () => {
  let handler: CreatePaymentCommandHandler;
  let mockWriteRepo: jest.Mocked<IPaymentWriteRepository>;
  let mockPort: jest.Mocked<IPaymentProviderPort>;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    mockWriteRepo = {
      save: jest.fn().mockImplementation((agg) => Promise.resolve(agg)),
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      delete: jest.fn(),
      findByIdempotencyKey: jest.fn().mockResolvedValue(null),
      findByProviderPaymentId: jest.fn(),
    };

    mockPort = {
      providerName: PaymentProviderEnum.STRIPE,
      createPaymentIntent: jest
        .fn()
        .mockResolvedValue({ providerPaymentId: 'pi_123' }),
      refundPayment: jest.fn(),
      createSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      verifyWebhookSignature: jest.fn(),
    };

    mockEventBus = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    } as unknown as jest.Mocked<EventBus>;

    handler = new CreatePaymentCommandHandler(
      mockWriteRepo,
      mockPort,
      new PaymentBuilder(),
      mockEventBus,
    );
  });

  function buildCommand(idempotencyKey = 'idem-1'): CreatePaymentCommand {
    return new CreatePaymentCommand({
      customerId: 'cus_123',
      amount: 1500,
      currency: CurrencyEnum.USD,
      idempotencyKey,
    });
  }

  it('calls the port once, persists the payment, and returns its id', async () => {
    const result = await handler.execute(buildCommand());

    expect(mockPort.createPaymentIntent).toHaveBeenCalledTimes(1);
    expect(mockWriteRepo.save).toHaveBeenCalledTimes(1);
    expect(result.paymentId).toHaveLength(36);
  });

  it('does not call the port on an idempotent retry', async () => {
    mockWriteRepo.findByIdempotencyKey.mockResolvedValue({
      id: 'existing-id',
    } as unknown as PaymentAggregate);

    const result = await handler.execute(buildCommand());

    expect(mockPort.createPaymentIntent).not.toHaveBeenCalled();
    expect(mockWriteRepo.save).not.toHaveBeenCalled();
    expect(result.paymentId).toBe('existing-id');
  });

  it('wraps a provider failure in PaymentProviderException and persists nothing', async () => {
    mockPort.createPaymentIntent.mockRejectedValue(new Error('card_declined'));

    await expect(handler.execute(buildCommand())).rejects.toThrow(
      PaymentProviderException,
    );
    expect(mockWriteRepo.save).not.toHaveBeenCalled();
  });

  it('rejects a non-positive amount at command construction', () => {
    expect(
      () =>
        new CreatePaymentCommand({
          customerId: 'cus_123',
          amount: -1,
          currency: CurrencyEnum.USD,
          idempotencyKey: 'idem-1',
        }),
    ).toThrow();
  });
});
