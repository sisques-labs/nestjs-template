import { UuidValueObject } from '@sisques-labs/nestjs-kit';

export class PaymentIdValueObject extends UuidValueObject {
  constructor(value: string) {
    super(value);
  }
}
