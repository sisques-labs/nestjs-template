export interface RefundPaymentPortInput {
  providerPaymentId: string;
  amount: number;
  reason?: string;
}
