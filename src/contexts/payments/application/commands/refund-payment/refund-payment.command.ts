import { StringValueObject } from '@sisques-labs/nestjs-kit';

import { PaymentIdValueObject } from '@contexts/payments/domain/value-objects/payment-id/payment-id.value-object';

export type RefundPaymentCommandInput = {
  paymentId: string;
  amount?: number;
  reason?: string;
};

export class RefundPaymentCommand {
  public readonly paymentId: PaymentIdValueObject;
  public readonly amount?: number;
  public readonly reason?: StringValueObject;

  constructor(input: RefundPaymentCommandInput) {
    this.paymentId = new PaymentIdValueObject(input.paymentId);
    this.amount = input.amount;
    this.reason = input.reason
      ? new StringValueObject(input.reason)
      : undefined;
  }
}
