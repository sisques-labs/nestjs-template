import { ConfigType, registerAs } from '@nestjs/config';

export type PaymentsProviderName = 'stripe';
export const DEFAULT_PAYMENTS_PROVIDER: PaymentsProviderName = 'stripe';

/**
 * Configuration for the `payments` context.
 *
 * - `PAYMENTS_PROVIDER` — which `IPaymentProviderPort` adapter to bind
 *   (`payment-provider.provider.ts`). Only `stripe` is implemented today;
 *   any other value fails fast at bootstrap rather than silently falling
 *   back, since a payments context bound to nothing would fail every
 *   request in a much more confusing way.
 * - `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — required when the
 *   `stripe` provider is selected.
 */
export const paymentsConfig = registerAs('payments', () => {
  const rawProvider = (process.env.PAYMENTS_PROVIDER ?? '').toLowerCase();
  const provider: PaymentsProviderName = (rawProvider ||
    DEFAULT_PAYMENTS_PROVIDER) as PaymentsProviderName;

  if (provider !== 'stripe') {
    throw new Error(
      `Unsupported PAYMENTS_PROVIDER '${provider}' — only 'stripe' is implemented`,
    );
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? '';
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

  if (provider === 'stripe' && (!stripeSecretKey || !stripeWebhookSecret)) {
    throw new Error(
      'PAYMENTS_PROVIDER=stripe requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to be set',
    );
  }

  return {
    provider,
    stripeSecretKey,
    stripeWebhookSecret,
  };
});

export type PaymentsConfig = ConfigType<typeof paymentsConfig>;
