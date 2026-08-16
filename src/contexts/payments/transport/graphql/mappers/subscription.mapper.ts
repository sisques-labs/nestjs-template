import { Injectable, Logger } from '@nestjs/common';
import { PaginatedResult } from '@sisques-labs/nestjs-kit';

import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { SubscriptionStatusEnum } from '@contexts/payments/domain/enums/subscription-status.enum';
import { SubscriptionViewModel } from '@contexts/payments/domain/view-models/subscription.view-model';
import {
  PaginatedSubscriptionResultDto,
  SubscriptionResponseDto,
} from '@contexts/payments/transport/graphql/dtos/responses/subscription.response.dto';

@Injectable()
export class SubscriptionGraphQLMapper {
  private readonly logger = new Logger(SubscriptionGraphQLMapper.name);

  toResponseDto(vm: SubscriptionViewModel): SubscriptionResponseDto {
    this.logger.log(
      `Mapping subscription view model to response dto: ${vm.id}`,
    );
    return {
      id: vm.id,
      provider: vm.provider as PaymentProviderEnum,
      providerSubscriptionId: vm.providerSubscriptionId,
      providerCustomerId: vm.providerCustomerId,
      customerId: vm.customerId,
      priceId: vm.priceId,
      status: vm.status as SubscriptionStatusEnum,
      currentPeriodStart: vm.currentPeriodStart,
      currentPeriodEnd: vm.currentPeriodEnd,
      cancelAtPeriodEnd: vm.cancelAtPeriodEnd,
      idempotencyKey: vm.idempotencyKey,
      metadata: vm.metadata,
      createdAt: vm.createdAt,
      updatedAt: vm.updatedAt,
    };
  }

  toPaginatedResponseDto(
    result: PaginatedResult<SubscriptionViewModel>,
  ): PaginatedSubscriptionResultDto {
    return {
      items: result.items.map((vm) => this.toResponseDto(vm)),
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      totalPages: result.totalPages,
    };
  }
}
