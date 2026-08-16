import { PaymentIdValueObject } from '@contexts/payments/domain/value-objects/payment-id/payment-id.value-object';

export type PaymentFindByIdQueryInput = {
  id: string;
};

export class PaymentFindByIdQuery {
  public readonly id: PaymentIdValueObject;

  constructor(input: PaymentFindByIdQueryInput) {
    this.id = new PaymentIdValueObject(input.id);
  }
}
