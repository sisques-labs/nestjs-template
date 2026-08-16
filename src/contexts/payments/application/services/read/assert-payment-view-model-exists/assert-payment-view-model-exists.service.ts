import { Inject, Injectable } from '@nestjs/common';

import { PaymentNotFoundException } from '@contexts/payments/domain/exceptions/payment-not-found.exception';
import {
  PAYMENT_READ_REPOSITORY,
  IPaymentReadRepository,
} from '@contexts/payments/domain/repositories/read/payment-read.repository';
import { PaymentIdValueObject } from '@contexts/payments/domain/value-objects/payment-id/payment-id.value-object';
import { PaymentViewModel } from '@contexts/payments/domain/view-models/payment.view-model';

@Injectable()
export class AssertPaymentViewModelExistsService {
  constructor(
    @Inject(PAYMENT_READ_REPOSITORY)
    private readonly paymentReadRepository: IPaymentReadRepository,
  ) {}

  async execute(id: PaymentIdValueObject): Promise<PaymentViewModel> {
    const payment = await this.paymentReadRepository.findById(id.value);
    if (!payment) throw new PaymentNotFoundException(id.value);
    return payment;
  }
}
