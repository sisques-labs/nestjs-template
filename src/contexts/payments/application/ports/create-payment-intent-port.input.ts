export interface CreatePaymentIntentPortInput {
  amount: number;
  currency: string;
  customerId: string;
  idempotencyKey: string;
  description?: string;
  metadata?: Record<string, string>;
}
