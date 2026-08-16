export interface SubscriptionPortResult {
  providerSubscriptionId: string;
  providerCustomerId: string;
  status: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}
