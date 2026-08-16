import { HttpStatus } from '@nestjs/common';
import { BaseException } from '@sisques-labs/nestjs-kit';

import { InvalidWebhookSignatureException } from '@contexts/payments/domain/exceptions/invalid-webhook-signature.exception';
import { PaymentNotFoundException } from '@contexts/payments/domain/exceptions/payment-not-found.exception';
import { PaymentProviderException } from '@contexts/payments/domain/exceptions/payment-provider.exception';
import { RefundExceedsPaymentAmountException } from '@contexts/payments/domain/exceptions/refund-exceeds-payment-amount.exception';
import { SubscriptionNotFoundException } from '@contexts/payments/domain/exceptions/subscription-not-found.exception';

export function resolvePaymentsExceptionStatus(
  exception: BaseException,
): number | undefined {
  if (
    exception instanceof PaymentNotFoundException ||
    exception instanceof SubscriptionNotFoundException
  ) {
    return HttpStatus.NOT_FOUND;
  }
  if (exception instanceof InvalidWebhookSignatureException) {
    return HttpStatus.BAD_REQUEST;
  }
  if (exception instanceof RefundExceedsPaymentAmountException) {
    return HttpStatus.BAD_REQUEST;
  }
  if (exception instanceof PaymentProviderException) {
    return HttpStatus.BAD_GATEWAY;
  }
  return undefined;
}
