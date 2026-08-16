import { Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Criteria } from '@sisques-labs/nestjs-kit';
import { FilterValidationPipe } from '@sisques-labs/nestjs-kit/graphql';

import { SubscriptionFindByCriteriaQuery } from '@contexts/payments/application/queries/subscription-find-by-criteria/subscription-find-by-criteria.query';
import { SubscriptionFindByIdQuery } from '@contexts/payments/application/queries/subscription-find-by-id/subscription-find-by-id.query';
import { subscriptionFilterableFields } from '@contexts/payments/transport/graphql/registries/subscription-filterable-fields.registry';
import { SubscriptionFindByCriteriaRequestDto } from '@contexts/payments/transport/graphql/dtos/requests/subscription-find-by-criteria.request.dto';
import { SubscriptionFindByIdRequestDto } from '@contexts/payments/transport/graphql/dtos/requests/subscription-find-by-id.request.dto';
import {
  PaginatedSubscriptionResultDto,
  SubscriptionResponseDto,
} from '@contexts/payments/transport/graphql/dtos/responses/subscription.response.dto';
import { SubscriptionGraphQLMapper } from '@contexts/payments/transport/graphql/mappers/subscription.mapper';

@Resolver()
export class SubscriptionQueriesResolver {
  private readonly logger = new Logger(SubscriptionQueriesResolver.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly subscriptionGraphQLMapper: SubscriptionGraphQLMapper,
  ) {}

  @Query(() => PaginatedSubscriptionResultDto)
  async subscriptionsFindByCriteria(
    @Args(
      'input',
      { nullable: true },
      new FilterValidationPipe(subscriptionFilterableFields),
    )
    input?: SubscriptionFindByCriteriaRequestDto,
  ): Promise<PaginatedSubscriptionResultDto> {
    this.logger.log('Finding subscriptions by criteria');

    const criteria = new Criteria(
      input?.filters,
      input?.sorts,
      input?.pagination,
    );
    const result = await this.queryBus.execute(
      new SubscriptionFindByCriteriaQuery(criteria),
    );

    return this.subscriptionGraphQLMapper.toPaginatedResponseDto(result);
  }

  @Query(() => SubscriptionResponseDto)
  async subscriptionFindById(
    @Args('input') input: SubscriptionFindByIdRequestDto,
  ): Promise<SubscriptionResponseDto> {
    this.logger.log(`Finding subscription by id: ${input.id}`);

    const result = await this.queryBus.execute(
      new SubscriptionFindByIdQuery({ id: input.id }),
    );

    return this.subscriptionGraphQLMapper.toResponseDto(result);
  }
}
