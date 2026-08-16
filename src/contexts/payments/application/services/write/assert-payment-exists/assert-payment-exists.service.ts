import { Inject, Injectable } from '@nestjs/common';

import { PaymentAggregate } from '@contexts/payments/domain/aggregates/payment.aggregate';
import { PaymentNotFoundException } from '@contexts/payments/domain/exceptions/payment-not-found.exception';
import {
  PAYMENT_WRITE_REPOSITORY,
  IPaymentWriteRepository,
} from '@contexts/payments/domain/repositories/write/payment-write.repository';
import { PaymentIdValueObject } from '@contexts/payments/domain/value-objects/payment-id/payment-id.value-object';

@Injectable()
export class AssertPaymentExistsService {
  constructor(
    @Inject(PAYMENT_WRITE_REPOSITORY)
    private readonly paymentWriteRepository: IPaymentWriteRepository,
  ) {}

  async execute(id: PaymentIdValueObject): Promise<PaymentAggregate> {
    const payment = await this.paymentWriteRepository.findById(id.value);
    if (!payment) throw new PaymentNotFoundException(id.value);
    return payment;
  }
}
