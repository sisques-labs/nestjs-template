import { Injectable } from '@nestjs/common';

import { PaymentViewModel } from '@contexts/payments/domain/view-models/payment.view-model';

import { PaymentRestResponseDto } from '../../dtos/payment-rest-response.dto';

@Injectable()
export class PaymentRestMapper {
  toResponse(vm: PaymentViewModel): PaymentRestResponseDto {
    const dto = new PaymentRestResponseDto();
    dto.id = vm.id;
    dto.provider = vm.provider;
    dto.providerPaymentId = vm.providerPaymentId;
    dto.customerId = vm.customerId;
    dto.amount = vm.amount;
    dto.currency = vm.currency;
    dto.status = vm.status;
    dto.idempotencyKey = vm.idempotencyKey;
    dto.refundedAmount = vm.refundedAmount;
    dto.description = vm.description;
    dto.metadata = vm.metadata;
    dto.createdAt = vm.createdAt;
    dto.updatedAt = vm.updatedAt;
    return dto;
  }
}
