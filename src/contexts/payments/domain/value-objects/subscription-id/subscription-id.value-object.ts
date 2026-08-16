import { UuidValueObject } from '@sisques-labs/nestjs-kit';

export class SubscriptionIdValueObject extends UuidValueObject {
  constructor(value: string) {
    super(value);
  }
}
