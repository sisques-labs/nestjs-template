/**
 * Provider-agnostic, normalized shape for an inbound webhook event. Adapters
 * translate their vendor's native event payload into this shape; nothing
 * above the adapter ever sees vendor-specific event names or fields.
 */
export interface PaymentProviderWebhookEvent {
  providerEventId: string;
  type:
    | 'payment_succeeded'
    | 'payment_failed'
    | 'charge_refunded'
    | 'invoice_paid'
    | 'subscription_updated'
    | 'subscription_deleted';
  providerPaymentId?: string;
  providerSubscriptionId?: string;
  refundedAmount?: number;
  subscriptionStatus?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}
