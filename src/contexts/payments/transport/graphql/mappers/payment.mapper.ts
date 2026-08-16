import { Injectable, Logger } from '@nestjs/common';
import { PaginatedResult } from '@sisques-labs/nestjs-kit';

import { CurrencyEnum } from '@contexts/payments/domain/enums/currency.enum';
import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { PaymentStatusEnum } from '@contexts/payments/domain/enums/payment-status.enum';
import { PaymentViewModel } from '@contexts/payments/domain/view-models/payment.view-model';
import {
  PaginatedPaymentResultDto,
  PaymentResponseDto,
} from '@contexts/payments/transport/graphql/dtos/responses/payment.response.dto';

@Injectable()
export class PaymentGraphQLMapper {
  private readonly logger = new Logger(PaymentGraphQLMapper.name);

  toResponseDto(vm: PaymentViewModel): PaymentResponseDto {
    this.logger.log(`Mapping payment view model to response dto: ${vm.id}`);
    return {
      id: vm.id,
      provider: vm.provider as PaymentProviderEnum,
      providerPaymentId: vm.providerPaymentId,
      customerId: vm.customerId,
      amount: vm.amount,
      currency: vm.currency as CurrencyEnum,
      status: vm.status as PaymentStatusEnum,
      idempotencyKey: vm.idempotencyKey,
      refundedAmount: vm.refundedAmount,
      description: vm.description,
      metadata: vm.metadata,
      createdAt: vm.createdAt,
      updatedAt: vm.updatedAt,
    };
  }

  toPaginatedResponseDto(
    result: PaginatedResult<PaymentViewModel>,
  ): PaginatedPaymentResultDto {
    return {
      items: result.items.map((vm) => this.toResponseDto(vm)),
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      totalPages: result.totalPages,
    };
  }
}
