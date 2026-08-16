import { Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { AssertSubscriptionViewModelExistsService } from '@contexts/payments/application/services/read/assert-subscription-view-model-exists/assert-subscription-view-model-exists.service';
import { SubscriptionViewModel } from '@contexts/payments/domain/view-models/subscription.view-model';

import { SubscriptionFindByIdQuery } from './subscription-find-by-id.query';

@QueryHandler(SubscriptionFindByIdQuery)
export class SubscriptionFindByIdQueryHandler implements IQueryHandler<
  SubscriptionFindByIdQuery,
  SubscriptionViewModel
> {
  private readonly logger = new Logger(SubscriptionFindByIdQueryHandler.name);

  constructor(
    private readonly assertSubscriptionViewModelExistsService: AssertSubscriptionViewModelExistsService,
  ) {}

  async execute(
    query: SubscriptionFindByIdQuery,
  ): Promise<SubscriptionViewModel> {
    this.logger.log(`Executing SubscriptionFindByIdQuery: ${query.id.value}`);
    return this.assertSubscriptionViewModelExistsService.execute(query.id);
  }
}
