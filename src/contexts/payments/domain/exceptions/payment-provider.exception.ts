import { BaseException } from '@sisques-labs/nestjs-kit';

/** Wraps a failure returned by the underlying `IPaymentProviderPort` adapter. */
export class PaymentProviderException extends BaseException {
  constructor(reason: string) {
    super(`Payment provider error: ${reason}`);
  }
}
