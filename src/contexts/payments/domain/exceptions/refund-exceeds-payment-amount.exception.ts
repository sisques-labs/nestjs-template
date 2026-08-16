import { BaseException } from '@sisques-labs/nestjs-kit';

export class RefundExceedsPaymentAmountException extends BaseException {
  constructor(paymentId: string) {
    super(
      `Refund amount exceeds the remaining unrefunded amount for payment '${paymentId}'`,
    );
  }
}
