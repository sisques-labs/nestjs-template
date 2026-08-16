import {
  DateValueObject,
  JsonValueObject,
  StringValueObject,
} from '@sisques-labs/nestjs-kit';

import { PaymentIdValueObject } from '@contexts/payments/domain/value-objects/payment-id/payment-id.value-object';
import { PaymentAmountValueObject } from '@contexts/payments/domain/value-objects/payment-amount/payment-amount.value-object';
import { CurrencyValueObject } from '@contexts/payments/domain/value-objects/currency/currency.value-object';
import { PaymentProviderValueObject } from '@contexts/payments/domain/value-objects/payment-provider/payment-provider.value-object';
import { PaymentStatusValueObject } from '@contexts/payments/domain/value-objects/payment-status/payment-status.value-object';
import { IdempotencyKeyValueObject } from '@contexts/payments/domain/value-objects/idempotency-key/idempotency-key.value-object';
import { NumberValueObject } from '@sisques-labs/nestjs-kit';

export interface IPayment {
  id: PaymentIdValueObject;
  provider: PaymentProviderValueObject;
  providerPaymentId?: StringValueObject;
  customerId: StringValueObject;
  amount: PaymentAmountValueObject;
  currency: CurrencyValueObject;
  status: PaymentStatusValueObject;
  idempotencyKey: IdempotencyKeyValueObject;
  refundedAmount: NumberValueObject;
  description?: StringValueObject;
  metadata?: JsonValueObject;
  createdAt: DateValueObject;
  updatedAt: DateValueObject;
}
