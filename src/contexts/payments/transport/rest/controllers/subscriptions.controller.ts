import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  Criteria,
  Filter,
  FilterOperator,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';

import { CancelSubscriptionCommand } from '@contexts/payments/application/commands/cancel-subscription/cancel-subscription.command';
import { CreateSubscriptionCommand } from '@contexts/payments/application/commands/create-subscription/create-subscription.command';
import { CreateSubscriptionResult } from '@contexts/payments/application/commands/create-subscription/create-subscription.result';
import { SubscriptionFindByCriteriaQuery } from '@contexts/payments/application/queries/subscription-find-by-criteria/subscription-find-by-criteria.query';
import { SubscriptionFindByIdQuery } from '@contexts/payments/application/queries/subscription-find-by-id/subscription-find-by-id.query';
import { SubscriptionStatusEnum } from '@contexts/payments/domain/enums/subscription-status.enum';
import { SubscriptionViewModel } from '@contexts/payments/domain/view-models/subscription.view-model';

import { CancelSubscriptionDto } from '../dtos/cancel-subscription.dto';
import { CreateSubscriptionDto } from '../dtos/create-subscription.dto';
import { SubscriptionRestResponseDto } from '../dtos/subscription-rest-response.dto';
import { SubscriptionRestMapper } from '../mappers/subscription/subscription.mapper';

/**
 * NOTE: unguarded — see `PaymentsController` and the context README for why.
 */
@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly subscriptionRestMapper: SubscriptionRestMapper,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a recurring subscription' })
  @ApiResponse({ status: 201, type: SubscriptionRestResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createSubscription(
    @Body() dto: CreateSubscriptionDto,
  ): Promise<SubscriptionRestResponseDto> {
    this.logger.log(`POST /subscriptions — customer: ${dto.customerId}`);

    const { subscriptionId } = await this.commandBus.execute<
      CreateSubscriptionCommand,
      CreateSubscriptionResult
    >(
      new CreateSubscriptionCommand({
        customerId: dto.customerId,
        priceId: dto.priceId,
        idempotencyKey: dto.idempotencyKey,
        metadata: dto.metadata,
      }),
    );

    const vm = await this.queryBus.execute<
      SubscriptionFindByIdQuery,
      SubscriptionViewModel
    >(new SubscriptionFindByIdQuery({ id: subscriptionId }));

    return this.subscriptionRestMapper.toResponse(vm);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List subscriptions' })
  @ApiResponse({ status: 200 })
  async subscriptionsFindByCriteria(
    @Query('status') status?: SubscriptionStatusEnum,
    @Query('customerId') customerId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResult<SubscriptionRestResponseDto>> {
    this.logger.log('GET /subscriptions');

    const filters: Filter[] = [];
    if (status) {
      filters.push({
        field: 'status',
        operator: FilterOperator.EQUALS,
        value: status,
      });
    }
    if (customerId) {
      filters.push({
        field: 'customer_id',
        operator: FilterOperator.EQUALS,
        value: customerId,
      });
    }

    const pagination =
      page || limit
        ? { page: page ? Number(page) : 1, perPage: limit ? Number(limit) : 20 }
        : undefined;

    const result = await this.queryBus.execute<
      SubscriptionFindByCriteriaQuery,
      PaginatedResult<SubscriptionViewModel>
    >(
      new SubscriptionFindByCriteriaQuery(
        new Criteria(filters, undefined, pagination),
      ),
    );

    return {
      items: result.items.map((vm) =>
        this.subscriptionRestMapper.toResponse(vm),
      ),
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      totalPages: result.totalPages,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a subscription by id' })
  @ApiResponse({ status: 200, type: SubscriptionRestResponseDto })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async subscriptionFindById(
    @Param('id') id: string,
  ): Promise<SubscriptionRestResponseDto> {
    this.logger.log(`GET /subscriptions/${id}`);

    const vm = await this.queryBus.execute<
      SubscriptionFindByIdQuery,
      SubscriptionViewModel
    >(new SubscriptionFindByIdQuery({ id }));

    return this.subscriptionRestMapper.toResponse(vm);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a subscription' })
  @ApiResponse({ status: 200, type: SubscriptionRestResponseDto })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async cancelSubscription(
    @Param('id') id: string,
    @Body() dto: CancelSubscriptionDto,
  ): Promise<SubscriptionRestResponseDto> {
    this.logger.log(`POST /subscriptions/${id}/cancel`);

    await this.commandBus.execute(
      new CancelSubscriptionCommand({
        subscriptionId: id,
        cancelAtPeriodEnd: dto.cancelAtPeriodEnd,
      }),
    );

    const vm = await this.queryBus.execute<
      SubscriptionFindByIdQuery,
      SubscriptionViewModel
    >(new SubscriptionFindByIdQuery({ id }));

    return this.subscriptionRestMapper.toResponse(vm);
  }
}
