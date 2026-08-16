import { Provider } from '@nestjs/common';

import { PAYMENT_PROVIDER_PORT } from '@contexts/payments/application/ports/payment-provider.port';
import { StripePaymentProviderAdapter } from '@contexts/payments/infrastructure/adapters/stripe-payment-provider.adapter';
import { PaymentsConfig, paymentsConfig } from './payments.config';

/**
 * Selects the `IPaymentProviderPort` implementation at DI time based on
 * `PaymentsConfig.provider` (`PAYMENTS_PROVIDER` env var). Adding a second
 * provider is a new `case` here plus a new adapter — nothing else changes.
 */
export const paymentProviderProvider: Provider = {
  provide: PAYMENT_PROVIDER_PORT,
  inject: [paymentsConfig.KEY, StripePaymentProviderAdapter],
  useFactory: (
    config: PaymentsConfig,
    stripeAdapter: StripePaymentProviderAdapter,
  ) => {
    switch (config.provider) {
      case 'stripe':
        return stripeAdapter;
      default:
        throw new Error(`Unsupported PAYMENTS_PROVIDER '${config.provider}'`);
    }
  },
};
