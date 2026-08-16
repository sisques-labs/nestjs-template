import { BooleanValueObject } from '@sisques-labs/nestjs-kit';

import { SubscriptionIdValueObject } from '@contexts/payments/domain/value-objects/subscription-id/subscription-id.value-object';

export type CancelSubscriptionCommandInput = {
  subscriptionId: string;
  cancelAtPeriodEnd?: boolean;
};

export class CancelSubscriptionCommand {
  public readonly subscriptionId: SubscriptionIdValueObject;
  public readonly cancelAtPeriodEnd: BooleanValueObject;

  constructor(input: CancelSubscriptionCommandInput) {
    this.subscriptionId = new SubscriptionIdValueObject(input.subscriptionId);
    this.cancelAtPeriodEnd = new BooleanValueObject(
      input.cancelAtPeriodEnd ?? true,
    );
  }
}
