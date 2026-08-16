import { BaseViewModel } from '@sisques-labs/nestjs-kit';

import { CurrencyEnum } from '@contexts/payments/domain/enums/currency.enum';
import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { PaymentStatusEnum } from '@contexts/payments/domain/enums/payment-status.enum';
import { IPaymentPrimitives } from '@contexts/payments/domain/primitives/payment.primitives';

export class PaymentViewModel extends BaseViewModel {
  public readonly provider: PaymentProviderEnum;
  public readonly providerPaymentId?: string;
  public readonly customerId: string;
  public readonly amount: number;
  public readonly currency: CurrencyEnum;
  public readonly status: PaymentStatusEnum;
  public readonly idempotencyKey: string;
  public readonly refundedAmount: number;
  public readonly description?: string;
  public readonly metadata?: Record<string, unknown>;

  constructor(props: IPaymentPrimitives) {
    super(props.id, props.createdAt, props.updatedAt);
    this.provider = props.provider;
    this.providerPaymentId = props.providerPaymentId;
    this.customerId = props.customerId;
    this.amount = props.amount;
    this.currency = props.currency;
    this.status = props.status;
    this.idempotencyKey = props.idempotencyKey;
    this.refundedAmount = props.refundedAmount;
    this.description = props.description;
    this.metadata = props.metadata;
  }
}
