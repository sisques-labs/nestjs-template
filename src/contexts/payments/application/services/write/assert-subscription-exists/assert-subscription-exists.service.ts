import { Inject, Injectable } from '@nestjs/common';

import { SubscriptionAggregate } from '@contexts/payments/domain/aggregates/subscription.aggregate';
import { SubscriptionNotFoundException } from '@contexts/payments/domain/exceptions/subscription-not-found.exception';
import {
  SUBSCRIPTION_WRITE_REPOSITORY,
  ISubscriptionWriteRepository,
} from '@contexts/payments/domain/repositories/write/subscription-write.repository';
import { SubscriptionIdValueObject } from '@contexts/payments/domain/value-objects/subscription-id/subscription-id.value-object';

@Injectable()
export class AssertSubscriptionExistsService {
  constructor(
    @Inject(SUBSCRIPTION_WRITE_REPOSITORY)
    private readonly subscriptionWriteRepository: ISubscriptionWriteRepository,
  ) {}

  async execute(id: SubscriptionIdValueObject): Promise<SubscriptionAggregate> {
    const subscription = await this.subscriptionWriteRepository.findById(
      id.value,
    );
    if (!subscription) throw new SubscriptionNotFoundException(id.value);
    return subscription;
  }
}
