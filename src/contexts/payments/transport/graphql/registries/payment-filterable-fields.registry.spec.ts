import { PaymentStatusEnum } from '@contexts/payments/domain/enums/payment-status.enum';
import { PaymentQueryableField } from '@contexts/payments/transport/graphql/enums/payment-queryable-field.enum';

import { paymentFilterableFields } from './payment-filterable-fields.registry';

describe('paymentFilterableFields', () => {
  it('has a registry entry for every PaymentQueryableField value', () => {
    for (const field of Object.values(PaymentQueryableField)) {
      expect(paymentFilterableFields[field]).toBeDefined();
    }
  });

  it('registers status as an enum backed by PaymentStatusEnum', () => {
    expect(paymentFilterableFields[PaymentQueryableField.STATUS]).toEqual({
      type: 'enum',
      enum: PaymentStatusEnum,
    });
  });

  it('rejects a field outside the whitelist', () => {
    expect(
      (paymentFilterableFields as Record<string, unknown>).idempotencyKey,
    ).toBeUndefined();
  });
});
