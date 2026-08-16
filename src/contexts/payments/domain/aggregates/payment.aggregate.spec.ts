import {
  DateValueObject,
  NumberValueObject,
  StringValueObject,
} from '@sisques-labs/nestjs-kit';

import { CurrencyEnum } from '@contexts/payments/domain/enums/currency.enum';
import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { PaymentStatusEnum } from '@contexts/payments/domain/enums/payment-status.enum';
import { CurrencyValueObject } from '@contexts/payments/domain/value-objects/currency/currency.value-object';
import { IdempotencyKeyValueObject } from '@contexts/payments/domain/value-objects/idempotency-key/idempotency-key.value-object';
import { PaymentAmountValueObject } from '@contexts/payments/domain/value-objects/payment-amount/payment-amount.value-object';
import { PaymentIdValueObject } from '@contexts/payments/domain/value-objects/payment-id/payment-id.value-object';
import { PaymentProviderValueObject } from '@contexts/payments/domain/value-objects/payment-provider/payment-provider.value-object';
import { PaymentStatusValueObject } from '@contexts/payments/domain/value-objects/payment-status/payment-status.value-object';

import { PaymentAggregate } from './payment.aggregate';

const PAYMENT_ID = '660e8400-e29b-41d4-a716-446655440001';

function buildPayment(
  overrides: { amount?: number; refundedAmount?: number } = {},
): PaymentAggregate {
  const now = new Date();
  return new PaymentAggregate({
    id: new PaymentIdValueObject(PAYMENT_ID),
    provider: new PaymentProviderValueObject(PaymentProviderEnum.STRIPE),
    providerPaymentId: new StringValueObject('pi_123'),
    customerId: new StringValueObject('cus_123'),
    amount: new PaymentAmountValueObject(overrides.amount ?? 1000),
    currency: new CurrencyValueObject(CurrencyEnum.USD),
    status: new PaymentStatusValueObject(PaymentStatusEnum.PENDING),
    idempotencyKey: new IdempotencyKeyValueObject('idem-1'),
    refundedAmount: new NumberValueObject(overrides.refundedAmount ?? 0, {
      min: 0,
      allowDecimals: false,
    }),
    createdAt: new DateValueObject(now),
    updatedAt: new DateValueObject(now),
  });
}

describe('PaymentAggregate', () => {
  it('create() emits PaymentCreated', () => {
    const payment = buildPayment();
    payment.create();

    const events = payment.getUncommittedEvents();
    expect(events).toHaveLength(1);
    expect(events[0].constructor.name).toBe('PaymentCreatedEvent');
  });

  it('markSucceeded() sets status SUCCEEDED and providerPaymentId, emits PaymentSucceeded', () => {
    const payment = buildPayment();
    payment.markSucceeded('pi_456');

    expect(payment.status).toBe(PaymentStatusEnum.SUCCEEDED);
    expect(payment.toPrimitives().providerPaymentId).toBe('pi_456');
    const events = payment.getUncommittedEvents();
    expect(events[events.length - 1].constructor.name).toBe(
      'PaymentSucceededEvent',
    );
  });

  it('markFailed() sets status FAILED and emits PaymentFailed', () => {
    const payment = buildPayment();
    payment.markFailed();

    expect(payment.status).toBe(PaymentStatusEnum.FAILED);
    const events = payment.getUncommittedEvents();
    expect(events[events.length - 1].constructor.name).toBe(
      'PaymentFailedEvent',
    );
  });

  describe('refund()', () => {
    it('a full refund sets status REFUNDED and refundedAmount = amount', () => {
      const payment = buildPayment({ amount: 1000 });
      payment.refund();

      const primitives = payment.toPrimitives();
      expect(primitives.refundedAmount).toBe(1000);
      expect(primitives.status).toBe(PaymentStatusEnum.REFUNDED);
    });

    it('a partial refund sets status PARTIALLY_REFUNDED', () => {
      const payment = buildPayment({ amount: 1000 });
      payment.refund(300);

      const primitives = payment.toPrimitives();
      expect(primitives.refundedAmount).toBe(300);
      expect(primitives.status).toBe(PaymentStatusEnum.PARTIALLY_REFUNDED);
    });

    it('emits PaymentRefunded', () => {
      const payment = buildPayment({ amount: 1000 });
      payment.refund(300);

      const events = payment.getUncommittedEvents();
      expect(events[events.length - 1].constructor.name).toBe(
        'PaymentRefundedEvent',
      );
    });

    it('rejects a refund larger than the remaining unrefunded amount', () => {
      const payment = buildPayment({ amount: 1000, refundedAmount: 800 });
      expect(() => payment.refund(300)).toThrow();
    });

    it('rejects a second refund after the payment is already fully refunded', () => {
      const payment = buildPayment({ amount: 1000, refundedAmount: 1000 });
      expect(() => payment.refund()).toThrow();
    });
  });
});
