import { Inject, Injectable } from '@nestjs/common';

import { SubscriptionNotFoundException } from '@contexts/payments/domain/exceptions/subscription-not-found.exception';
import {
  SUBSCRIPTION_READ_REPOSITORY,
  ISubscriptionReadRepository,
} from '@contexts/payments/domain/repositories/read/subscription-read.repository';
import { SubscriptionIdValueObject } from '@contexts/payments/domain/value-objects/subscription-id/subscription-id.value-object';
import { SubscriptionViewModel } from '@contexts/payments/domain/view-models/subscription.view-model';

@Injectable()
export class AssertSubscriptionViewModelExistsService {
  constructor(
    @Inject(SUBSCRIPTION_READ_REPOSITORY)
    private readonly subscriptionReadRepository: ISubscriptionReadRepository,
  ) {}

  async execute(id: SubscriptionIdValueObject): Promise<SubscriptionViewModel> {
    const subscription = await this.subscriptionReadRepository.findById(
      id.value,
    );
    if (!subscription) throw new SubscriptionNotFoundException(id.value);
    return subscription;
  }
}
