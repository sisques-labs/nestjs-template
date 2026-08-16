import { JsonValueObject, StringValueObject } from '@sisques-labs/nestjs-kit';

import { CurrencyEnum } from '@contexts/payments/domain/enums/currency.enum';
import { CurrencyValueObject } from '@contexts/payments/domain/value-objects/currency/currency.value-object';
import { IdempotencyKeyValueObject } from '@contexts/payments/domain/value-objects/idempotency-key/idempotency-key.value-object';
import { PaymentAmountValueObject } from '@contexts/payments/domain/value-objects/payment-amount/payment-amount.value-object';

export type CreatePaymentCommandInput = {
  customerId: string;
  amount: number;
  currency: CurrencyEnum;
  idempotencyKey: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

export class CreatePaymentCommand {
  public readonly customerId: StringValueObject;
  public readonly amount: PaymentAmountValueObject;
  public readonly currency: CurrencyValueObject;
  public readonly idempotencyKey: IdempotencyKeyValueObject;
  public readonly description?: StringValueObject;
  public readonly metadata?: JsonValueObject;

  constructor(input: CreatePaymentCommandInput) {
    this.customerId = new StringValueObject(input.customerId);
    this.amount = new PaymentAmountValueObject(input.amount);
    this.currency = new CurrencyValueObject(input.currency);
    this.idempotencyKey = new IdempotencyKeyValueObject(input.idempotencyKey);
    this.description = input.description
      ? new StringValueObject(input.description)
      : undefined;
    this.metadata = input.metadata
      ? new JsonValueObject(input.metadata)
      : undefined;
  }
}
