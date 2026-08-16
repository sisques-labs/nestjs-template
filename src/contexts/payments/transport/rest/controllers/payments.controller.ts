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

import { CreatePaymentCommand } from '@contexts/payments/application/commands/create-payment/create-payment.command';
import { CreatePaymentResult } from '@contexts/payments/application/commands/create-payment/create-payment.result';
import { RefundPaymentCommand } from '@contexts/payments/application/commands/refund-payment/refund-payment.command';
import { PaymentFindByCriteriaQuery } from '@contexts/payments/application/queries/payment-find-by-criteria/payment-find-by-criteria.query';
import { PaymentFindByIdQuery } from '@contexts/payments/application/queries/payment-find-by-id/payment-find-by-id.query';
import { PaymentStatusEnum } from '@contexts/payments/domain/enums/payment-status.enum';
import { PaymentViewModel } from '@contexts/payments/domain/view-models/payment.view-model';

import { CreatePaymentDto } from '../dtos/create-payment.dto';
import { PaymentRestResponseDto } from '../dtos/payment-rest-response.dto';
import { RefundPaymentDto } from '../dtos/refund-payment.dto';
import { PaymentRestMapper } from '../mappers/payment/payment.mapper';

/**
 * NOTE: unguarded. This template has no auth infrastructure yet — see
 * `src/contexts/payments/README.md` for the explicit limitation and what a
 * consuming service must add before exposing these routes publicly.
 */
@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly paymentRestMapper: PaymentRestMapper,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a one-off payment' })
  @ApiResponse({ status: 201, type: PaymentRestResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createPayment(
    @Body() dto: CreatePaymentDto,
  ): Promise<PaymentRestResponseDto> {
    this.logger.log(`POST /payments — customer: ${dto.customerId}`);

    const { paymentId } = await this.commandBus.execute<
      CreatePaymentCommand,
      CreatePaymentResult
    >(
      new CreatePaymentCommand({
        customerId: dto.customerId,
        amount: dto.amount,
        currency: dto.currency,
        idempotencyKey: dto.idempotencyKey,
        description: dto.description,
        metadata: dto.metadata,
      }),
    );

    const vm = await this.queryBus.execute<
      PaymentFindByIdQuery,
      PaymentViewModel
    >(new PaymentFindByIdQuery({ id: paymentId }));

    return this.paymentRestMapper.toResponse(vm);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List payments' })
  @ApiResponse({ status: 200 })
  async paymentsFindByCriteria(
    @Query('status') status?: PaymentStatusEnum,
    @Query('customerId') customerId?: string,
    @Query('createdAfter') createdAfter?: string,
    @Query('createdBefore') createdBefore?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResult<PaymentRestResponseDto>> {
    this.logger.log('GET /payments');

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
    if (createdAfter) {
      filters.push({
        field: 'created_at',
        operator: FilterOperator.GREATER_THAN_OR_EQUAL,
        value: new Date(createdAfter),
      });
    }
    if (createdBefore) {
      filters.push({
        field: 'created_at',
        operator: FilterOperator.LESS_THAN_OR_EQUAL,
        value: new Date(createdBefore),
      });
    }

    const pagination =
      page || limit
        ? { page: page ? Number(page) : 1, perPage: limit ? Number(limit) : 20 }
        : undefined;

    const result = await this.queryBus.execute<
      PaymentFindByCriteriaQuery,
      PaginatedResult<PaymentViewModel>
    >(
      new PaymentFindByCriteriaQuery(
        new Criteria(filters, undefined, pagination),
      ),
    );

    return {
      items: result.items.map((vm) => this.paymentRestMapper.toResponse(vm)),
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      totalPages: result.totalPages,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a payment by id' })
  @ApiResponse({ status: 200, type: PaymentRestResponseDto })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async paymentFindById(
    @Param('id') id: string,
  ): Promise<PaymentRestResponseDto> {
    this.logger.log(`GET /payments/${id}`);

    const vm = await this.queryBus.execute<
      PaymentFindByIdQuery,
      PaymentViewModel
    >(new PaymentFindByIdQuery({ id }));

    return this.paymentRestMapper.toResponse(vm);
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refund a payment (full or partial)' })
  @ApiResponse({ status: 200, type: PaymentRestResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid refund amount' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async refundPayment(
    @Param('id') id: string,
    @Body() dto: RefundPaymentDto,
  ): Promise<PaymentRestResponseDto> {
    this.logger.log(`POST /payments/${id}/refund`);

    await this.commandBus.execute(
      new RefundPaymentCommand({
        paymentId: id,
        amount: dto.amount,
        reason: dto.reason,
      }),
    );

    const vm = await this.queryBus.execute<
      PaymentFindByIdQuery,
      PaymentViewModel
    >(new PaymentFindByIdQuery({ id }));

    return this.paymentRestMapper.toResponse(vm);
  }
}
