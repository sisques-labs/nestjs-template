import { NumberValueObject } from '@sisques-labs/nestjs-kit';

/**
 * Integer minor units (e.g. cents). `min: 1` — a payment amount MUST be
 * strictly positive; use a plain `NumberValueObject` for fields that may be
 * zero (e.g. `refundedAmount`).
 */
export class PaymentAmountValueObject extends NumberValueObject {
  constructor(value: number) {
    super(value, { min: 1, allowDecimals: false });
  }
}
