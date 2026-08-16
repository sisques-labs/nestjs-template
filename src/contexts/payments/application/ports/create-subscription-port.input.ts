export interface CreateSubscriptionPortInput {
  customerId: string;
  priceId: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}
