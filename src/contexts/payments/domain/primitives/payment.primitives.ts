import { BasePrimitives } from '@sisques-labs/nestjs-kit';

import { CurrencyEnum } from '@contexts/payments/domain/enums/currency.enum';
import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { PaymentStatusEnum } from '@contexts/payments/domain/enums/payment-status.enum';

export type IPaymentPrimitives = BasePrimitives & {
  provider: PaymentProviderEnum;
  providerPaymentId?: string;
  customerId: string;
  amount: number;
  currency: CurrencyEnum;
  status: PaymentStatusEnum;
  idempotencyKey: string;
  refundedAmount: number;
  description?: string;
  metadata?: Record<string, unknown>;
};
