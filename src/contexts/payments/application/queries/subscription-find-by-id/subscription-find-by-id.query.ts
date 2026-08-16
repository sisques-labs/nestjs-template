import { SubscriptionIdValueObject } from '@contexts/payments/domain/value-objects/subscription-id/subscription-id.value-object';

export type SubscriptionFindByIdQueryInput = {
  id: string;
};

export class SubscriptionFindByIdQuery {
  public readonly id: SubscriptionIdValueObject;

  constructor(input: SubscriptionFindByIdQueryInput) {
    this.id = new SubscriptionIdValueObject(input.id);
  }
}
