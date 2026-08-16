import { Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { AssertPaymentViewModelExistsService } from '@contexts/payments/application/services/read/assert-payment-view-model-exists/assert-payment-view-model-exists.service';
import { PaymentViewModel } from '@contexts/payments/domain/view-models/payment.view-model';

import { PaymentFindByIdQuery } from './payment-find-by-id.query';

@QueryHandler(PaymentFindByIdQuery)
export class PaymentFindByIdQueryHandler implements IQueryHandler<
  PaymentFindByIdQuery,
  PaymentViewModel
> {
  private readonly logger = new Logger(PaymentFindByIdQueryHandler.name);

  constructor(
    private readonly assertPaymentViewModelExistsService: AssertPaymentViewModelExistsService,
  ) {}

  async execute(query: PaymentFindByIdQuery): Promise<PaymentViewModel> {
    this.logger.log(`Executing PaymentFindByIdQuery: ${query.id.value}`);
    return this.assertPaymentViewModelExistsService.execute(query.id);
  }
}
