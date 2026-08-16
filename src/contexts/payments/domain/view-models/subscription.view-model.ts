import { BaseViewModel } from '@sisques-labs/nestjs-kit';

import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { SubscriptionStatusEnum } from '@contexts/payments/domain/enums/subscription-status.enum';
import { ISubscriptionPrimitives } from '@contexts/payments/domain/primitives/subscription.primitives';

export class SubscriptionViewModel extends BaseViewModel {
  public readonly provider: PaymentProviderEnum;
  public readonly providerSubscriptionId?: string;
  public readonly providerCustomerId?: string;
  public readonly customerId: string;
  public readonly priceId: string;
  public readonly status: SubscriptionStatusEnum;
  public readonly currentPeriodStart?: Date;
  public readonly currentPeriodEnd?: Date;
  public readonly cancelAtPeriodEnd: boolean;
  public readonly idempotencyKey: string;
  public readonly metadata?: Record<string, unknown>;

  constructor(props: ISubscriptionPrimitives) {
    super(props.id, props.createdAt, props.updatedAt);
    this.provider = props.provider;
    this.providerSubscriptionId = props.providerSubscriptionId;
    this.providerCustomerId = props.providerCustomerId;
    this.customerId = props.customerId;
    this.priceId = props.priceId;
    this.status = props.status;
    this.currentPeriodStart = props.currentPeriodStart;
    this.currentPeriodEnd = props.currentPeriodEnd;
    this.cancelAtPeriodEnd = props.cancelAtPeriodEnd;
    this.idempotencyKey = props.idempotencyKey;
    this.metadata = props.metadata;
  }
}
