import { Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Criteria } from '@sisques-labs/nestjs-kit';
import { FilterValidationPipe } from '@sisques-labs/nestjs-kit/graphql';

import { PaymentFindByCriteriaQuery } from '@contexts/payments/application/queries/payment-find-by-criteria/payment-find-by-criteria.query';
import { PaymentFindByIdQuery } from '@contexts/payments/application/queries/payment-find-by-id/payment-find-by-id.query';
import { paymentFilterableFields } from '@contexts/payments/transport/graphql/registries/payment-filterable-fields.registry';
import { PaymentFindByCriteriaRequestDto } from '@contexts/payments/transport/graphql/dtos/requests/payment-find-by-criteria.request.dto';
import { PaymentFindByIdRequestDto } from '@contexts/payments/transport/graphql/dtos/requests/payment-find-by-id.request.dto';
import {
  PaginatedPaymentResultDto,
  PaymentResponseDto,
} from '@contexts/payments/transport/graphql/dtos/responses/payment.response.dto';
import { PaymentGraphQLMapper } from '@contexts/payments/transport/graphql/mappers/payment.mapper';

@Resolver()
export class PaymentQueriesResolver {
  private readonly logger = new Logger(PaymentQueriesResolver.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly paymentGraphQLMapper: PaymentGraphQLMapper,
  ) {}

  @Query(() => PaginatedPaymentResultDto)
  async paymentsFindByCriteria(
    @Args(
      'input',
      { nullable: true },
      new FilterValidationPipe(paymentFilterableFields),
    )
    input?: PaymentFindByCriteriaRequestDto,
  ): Promise<PaginatedPaymentResultDto> {
    this.logger.log('Finding payments by criteria');

    const criteria = new Criteria(
      input?.filters,
      input?.sorts,
      input?.pagination,
    );
    const result = await this.queryBus.execute(
      new PaymentFindByCriteriaQuery(criteria),
    );

    return this.paymentGraphQLMapper.toPaginatedResponseDto(result);
  }

  @Query(() => PaymentResponseDto)
  async paymentFindById(
    @Args('input') input: PaymentFindByIdRequestDto,
  ): Promise<PaymentResponseDto> {
    this.logger.log(`Finding payment by id: ${input.id}`);

    const result = await this.queryBus.execute(
      new PaymentFindByIdQuery({ id: input.id }),
    );

    return this.paymentGraphQLMapper.toResponseDto(result);
  }
}
