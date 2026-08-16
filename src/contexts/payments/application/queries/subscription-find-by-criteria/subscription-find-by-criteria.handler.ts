import { Inject, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PaginatedResult } from '@sisques-labs/nestjs-kit';

import {
  SUBSCRIPTION_READ_REPOSITORY,
  ISubscriptionReadRepository,
} from '@contexts/payments/domain/repositories/read/subscription-read.repository';
import { SubscriptionViewModel } from '@contexts/payments/domain/view-models/subscription.view-model';

import { SubscriptionFindByCriteriaQuery } from './subscription-find-by-criteria.query';

@QueryHandler(SubscriptionFindByCriteriaQuery)
export class SubscriptionFindByCriteriaQueryHandler implements IQueryHandler<
  SubscriptionFindByCriteriaQuery,
  PaginatedResult<SubscriptionViewModel>
> {
  private readonly logger = new Logger(
    SubscriptionFindByCriteriaQueryHandler.name,
  );

  constructor(
    @Inject(SUBSCRIPTION_READ_REPOSITORY)
    private readonly subscriptionReadRepository: ISubscriptionReadRepository,
  ) {}

  async execute(
    query: SubscriptionFindByCriteriaQuery,
  ): Promise<PaginatedResult<SubscriptionViewModel>> {
    this.logger.log('Executing SubscriptionFindByCriteriaQuery');
    return this.subscriptionReadRepository.findByCriteria(query.criteria);
  }
}
