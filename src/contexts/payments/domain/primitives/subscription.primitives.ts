import { BasePrimitives } from '@sisques-labs/nestjs-kit';

import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { SubscriptionStatusEnum } from '@contexts/payments/domain/enums/subscription-status.enum';

export type ISubscriptionPrimitives = BasePrimitives & {
  provider: PaymentProviderEnum;
  providerSubscriptionId?: string;
  providerCustomerId?: string;
  customerId: string;
  priceId: string;
  status: SubscriptionStatusEnum;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};
