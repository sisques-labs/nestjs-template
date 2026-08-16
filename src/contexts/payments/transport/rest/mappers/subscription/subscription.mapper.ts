import { Injectable } from '@nestjs/common';

import { SubscriptionViewModel } from '@contexts/payments/domain/view-models/subscription.view-model';

import { SubscriptionRestResponseDto } from '../../dtos/subscription-rest-response.dto';

@Injectable()
export class SubscriptionRestMapper {
  toResponse(vm: SubscriptionViewModel): SubscriptionRestResponseDto {
    const dto = new SubscriptionRestResponseDto();
    dto.id = vm.id;
    dto.provider = vm.provider;
    dto.providerSubscriptionId = vm.providerSubscriptionId;
    dto.providerCustomerId = vm.providerCustomerId;
    dto.customerId = vm.customerId;
    dto.priceId = vm.priceId;
    dto.status = vm.status;
    dto.currentPeriodStart = vm.currentPeriodStart;
    dto.currentPeriodEnd = vm.currentPeriodEnd;
    dto.cancelAtPeriodEnd = vm.cancelAtPeriodEnd;
    dto.idempotencyKey = vm.idempotencyKey;
    dto.metadata = vm.metadata;
    dto.createdAt = vm.createdAt;
    dto.updatedAt = vm.updatedAt;
    return dto;
  }
}
