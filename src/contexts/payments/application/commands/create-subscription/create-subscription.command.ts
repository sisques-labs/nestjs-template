import { JsonValueObject, StringValueObject } from '@sisques-labs/nestjs-kit';

import { IdempotencyKeyValueObject } from '@contexts/payments/domain/value-objects/idempotency-key/idempotency-key.value-object';

export type CreateSubscriptionCommandInput = {
  customerId: string;
  priceId: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

export class CreateSubscriptionCommand {
  public readonly customerId: StringValueObject;
  public readonly priceId: StringValueObject;
  public readonly idempotencyKey: IdempotencyKeyValueObject;
  public readonly metadata?: JsonValueObject;

  constructor(input: CreateSubscriptionCommandInput) {
    this.customerId = new StringValueObject(input.customerId);
    this.priceId = new StringValueObject(input.priceId);
    this.idempotencyKey = new IdempotencyKeyValueObject(input.idempotencyKey);
    this.metadata = input.metadata
      ? new JsonValueObject(input.metadata)
      : undefined;
  }
}
