import { Inject, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

import { CreatePaymentIntentPortInput } from '@contexts/payments/application/ports/create-payment-intent-port.input';
import { CreateSubscriptionPortInput } from '@contexts/payments/application/ports/create-subscription-port.input';
import { IPaymentProviderPort } from '@contexts/payments/application/ports/payment-provider.port';
import { PaymentIntentPortResult } from '@contexts/payments/application/ports/payment-intent-port.result';
import { PaymentProviderWebhookEvent } from '@contexts/payments/application/ports/payment-provider-webhook-event.interface';
import { RefundPaymentPortInput } from '@contexts/payments/application/ports/refund-payment-port.input';
import { RefundPortResult } from '@contexts/payments/application/ports/refund-port.result';
import { SubscriptionPortResult } from '@contexts/payments/application/ports/subscription-port.result';
import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import {
  PaymentsConfig,
  paymentsConfig,
} from '@contexts/payments/infrastructure/config/payments.config';

/**
 * The only file in this context allowed to import the `stripe` package —
 * enforced by `payments-provider-sdk-isolation.spec.ts`. Everything above
 * this adapter talks to `IPaymentProviderPort` only.
 */
@Injectable()
export class StripePaymentProviderAdapter implements IPaymentProviderPort {
  public readonly providerName = PaymentProviderEnum.STRIPE;

  private readonly logger = new Logger(StripePaymentProviderAdapter.name);
  private readonly stripe: Stripe;

  constructor(
    @Inject(paymentsConfig.KEY)
    private readonly config: PaymentsConfig,
  ) {
    this.stripe = new Stripe(config.stripeSecretKey);
  }

  async createPaymentIntent(
    input: CreatePaymentIntentPortInput,
  ): Promise<PaymentIntentPortResult> {
    this.logger.log(
      `Creating Stripe PaymentIntent for customer: ${input.customerId}`,
    );
    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: input.amount,
        currency: input.currency.toLowerCase(),
        description: input.description,
        metadata: input.metadata,
      },
      { idempotencyKey: input.idempotencyKey },
    );
    this.logger.log(`Stripe PaymentIntent created: ${paymentIntent.id}`);
    return { providerPaymentId: paymentIntent.id };
  }

  async refundPayment(
    input: RefundPaymentPortInput,
  ): Promise<RefundPortResult> {
    this.logger.log(
      `Refunding Stripe PaymentIntent: ${input.providerPaymentId}`,
    );
    const refund = await this.stripe.refunds.create({
      payment_intent: input.providerPaymentId,
      amount: input.amount,
    });
    this.logger.log(`Stripe refund created: ${refund.id}`);
    return { providerRefundId: refund.id };
  }

  async createSubscription(
    input: CreateSubscriptionPortInput,
  ): Promise<SubscriptionPortResult> {
    this.logger.log(
      `Creating Stripe subscription for customer: ${input.customerId}`,
    );
    const subscription = await this.stripe.subscriptions.create(
      {
        customer: input.customerId,
        items: [{ price: input.priceId }],
        metadata: input.metadata,
      },
      { idempotencyKey: input.idempotencyKey },
    );
    this.logger.log(`Stripe subscription created: ${subscription.id}`);
    return {
      providerSubscriptionId: subscription.id,
      providerCustomerId: input.customerId,
      status: subscription.status,
      currentPeriodStart: subscription.items.data[0]?.current_period_start
        ? new Date(subscription.items.data[0].current_period_start * 1000)
        : undefined,
      currentPeriodEnd: subscription.items.data[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000)
        : undefined,
    };
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    this.logger.log(`Canceling Stripe subscription: ${providerSubscriptionId}`);
    await this.stripe.subscriptions.cancel(providerSubscriptionId);
  }

  verifyWebhookSignature(
    rawBody: Buffer,
    signature: string,
  ): PaymentProviderWebhookEvent {
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.config.stripeWebhookSecret,
    );
    return this.normalizeEvent(event);
  }

  private normalizeEvent(event: Stripe.Event): PaymentProviderWebhookEvent {
    const base = { providerEventId: event.id };

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        return {
          ...base,
          type: 'payment_succeeded',
          providerPaymentId: paymentIntent.id,
        };
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        return {
          ...base,
          type: 'payment_failed',
          providerPaymentId: paymentIntent.id,
        };
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        return {
          ...base,
          type: 'charge_refunded',
          providerPaymentId:
            typeof charge.payment_intent === 'string'
              ? charge.payment_intent
              : charge.payment_intent?.id,
          refundedAmount: charge.amount_refunded,
        };
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          typeof invoice.parent?.subscription_details?.subscription === 'string'
            ? invoice.parent.subscription_details.subscription
            : invoice.parent?.subscription_details?.subscription?.id;
        return {
          ...base,
          type: 'invoice_paid',
          providerSubscriptionId: subscriptionId,
          subscriptionStatus: 'ACTIVE',
        };
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        return {
          ...base,
          type: 'subscription_updated',
          providerSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status.toUpperCase(),
          currentPeriodStart: subscription.items.data[0]?.current_period_start
            ? new Date(subscription.items.data[0].current_period_start * 1000)
            : undefined,
          currentPeriodEnd: subscription.items.data[0]?.current_period_end
            ? new Date(subscription.items.data[0].current_period_end * 1000)
            : undefined,
        };
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        return {
          ...base,
          type: 'subscription_deleted',
          providerSubscriptionId: subscription.id,
          subscriptionStatus: 'CANCELED',
        };
      }
      default:
        throw new Error(`Unsupported Stripe event type: ${event.type}`);
    }
  }
}
