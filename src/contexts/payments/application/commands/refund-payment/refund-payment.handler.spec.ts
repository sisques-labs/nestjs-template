import {
  DateValueObject,
  NumberValueObject,
  StringValueObject,
} from '@sisques-labs/nestjs-kit';
import { EventBus } from '@nestjs/cqrs';

import { AssertPaymentExistsService } from '@contexts/payments/application/services/write/assert-payment-exists/assert-payment-exists.service';
import { IPaymentProviderPort } from '@contexts/payments/application/ports/payment-provider.port';
import { PaymentAggregate } from '@contexts/payments/domain/aggregates/payment.aggregate';
import { CurrencyEnum } from '@contexts/payments/domain/enums/currency.enum';
import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { PaymentStatusEnum } from '@contexts/payments/domain/enums/payment-status.enum';
import { PaymentNotFoundException } from '@contexts/payments/domain/exceptions/payment-not-found.exception';
import { IPaymentWriteRepository } from '@contexts/payments/domain/repositories/write/payment-write.repository';
import { CurrencyValueObject } from '@contexts/payments/domain/value-objects/currency/currency.value-object';
import { IdempotencyKeyValueObject } from '@contexts/payments/domain/value-objects/idempotency-key/idempotency-key.value-object';
import { PaymentAmountValueObject } from '@contexts/payments/domain/value-objects/payment-amount/payment-amount.value-object';
import { PaymentIdValueObject } from '@contexts/payments/domain/value-objects/payment-id/payment-id.value-object';
import { PaymentProviderValueObject } from '@contexts/payments/domain/value-objects/payment-provider/payment-provider.value-object';
import { PaymentStatusValueObject } from '@contexts/payments/domain/value-objects/payment-status/payment-status.value-object';

import { RefundPaymentCommand } from './refund-payment.command';
import { RefundPaymentCommandHandler } from './refund-payment.handler';

const PAYMENT_ID = '660e8400-e29b-41d4-a716-446655440001';

function buildPayment(
  amount: number,
  refundedAmount: number,
): PaymentAggregate {
  const now = new Date();
  return new PaymentAggregate({
    id: new PaymentIdValueObject(PAYMENT_ID),
    provider: new PaymentProviderValueObject(PaymentProviderEnum.STRIPE),
    providerPaymentId: new StringValueObject('pi_123'),
    customerId: new StringValueObject('cus_123'),
    amount: new PaymentAmountValueObject(amount),
    currency: new CurrencyValueObject(CurrencyEnum.USD),
    status: new PaymentStatusValueObject(PaymentStatusEnum.SUCCEEDED),
    idempotencyKey: new IdempotencyKeyValueObject('idem-1'),
    refundedAmount: new NumberValueObject(refundedAmount, {
      min: 0,
      allowDecimals: false,
    }),
    createdAt: new DateValueObject(now),
    updatedAt: new DateValueObject(now),
  });
}

describe('RefundPaymentCommandHandler', () => {
  let handler: RefundPaymentCommandHandler;
  let mockWriteRepo: jest.Mocked<IPaymentWriteRepository>;
  let mockPort: jest.Mocked<IPaymentProviderPort>;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    mockWriteRepo = {
      save: jest.fn().mockImplementation((agg) => Promise.resolve(agg)),
      findById: jest.fn().mockResolvedValue(buildPayment(1000, 0)),
      findByCriteria: jest.fn(),
      delete: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      findByProviderPaymentId: jest.fn(),
    };

    mockPort = {
      providerName: PaymentProviderEnum.STRIPE,
      createPaymentIntent: jest.fn(),
      refundPayment: jest.fn().mockResolvedValue({ providerRefundId: 're_1' }),
      createSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      verifyWebhookSignature: jest.fn(),
    };

    mockEventBus = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    } as unknown as jest.Mocked<EventBus>;

    handler = new RefundPaymentCommandHandler(
      new AssertPaymentExistsService(mockWriteRepo),
      mockWriteRepo,
      mockPort,
      mockEventBus,
    );
  });

  it('refunds the full remaining amount by default and calls the port', async () => {
    await handler.execute(new RefundPaymentCommand({ paymentId: PAYMENT_ID }));

    expect(mockPort.refundPayment).toHaveBeenCalledTimes(1);
    expect(mockWriteRepo.save).toHaveBeenCalledTimes(1);
  });

  it('rejects an over-refund BEFORE calling the port', async () => {
    mockWriteRepo.findById.mockResolvedValue(buildPayment(1000, 800));

    await expect(
      handler.execute(
        new RefundPaymentCommand({ paymentId: PAYMENT_ID, amount: 300 }),
      ),
    ).rejects.toThrow();
    expect(mockPort.refundPayment).not.toHaveBeenCalled();
  });

  it('throws PaymentNotFoundException when the payment does not exist', async () => {
    mockWriteRepo.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new RefundPaymentCommand({ paymentId: PAYMENT_ID })),
    ).rejects.toThrow(PaymentNotFoundException);
  });
});
