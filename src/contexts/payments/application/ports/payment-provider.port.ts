import { CreatePaymentIntentPortInput } from '@contexts/payments/application/ports/create-payment-intent-port.input';
import { CreateSubscriptionPortInput } from '@contexts/payments/application/ports/create-subscription-port.input';
import { PaymentIntentPortResult } from '@contexts/payments/application/ports/payment-intent-port.result';
import { PaymentProviderWebhookEvent } from '@contexts/payments/application/ports/payment-provider-webhook-event.interface';
import { RefundPaymentPortInput } from '@contexts/payments/application/ports/refund-payment-port.input';
import { RefundPortResult } from '@contexts/payments/application/ports/refund-port.result';
import { SubscriptionPortResult } from '@contexts/payments/application/ports/subscription-port.result';
import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';

export const PAYMENT_PROVIDER_PORT = Symbol('PAYMENT_PROVIDER_PORT');

/**
 * Hexagonal seam that keeps domain/application/transport ignorant of WHICH
 * payment provider is behind it. `StripePaymentProviderAdapter` is the only
 * implementation today; `payment-provider.provider.ts` selects it via
 * `PAYMENTS_PROVIDER` — no other layer changes when a second provider is
 * added.
 */
export interface IPaymentProviderPort {
  /** The provider this adapter instance talks to — lets handlers stamp the aggregate's `provider` field without hardcoding it. */
  readonly providerName: PaymentProviderEnum;
  createPaymentIntent(
    input: CreatePaymentIntentPortInput,
  ): Promise<PaymentIntentPortResult>;
  refundPayment(input: RefundPaymentPortInput): Promise<RefundPortResult>;
  createSubscription(
    input: CreateSubscriptionPortInput,
  ): Promise<SubscriptionPortResult>;
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
  verifyWebhookSignature(
    rawBody: Buffer,
    signature: string,
  ): PaymentProviderWebhookEvent;
}
