import { Inject, Logger } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PaginatedResult } from '@sisques-labs/nestjs-kit';

import {
  PAYMENT_READ_REPOSITORY,
  IPaymentReadRepository,
} from '@contexts/payments/domain/repositories/read/payment-read.repository';
import { PaymentViewModel } from '@contexts/payments/domain/view-models/payment.view-model';

import { PaymentFindByCriteriaQuery } from './payment-find-by-criteria.query';

@QueryHandler(PaymentFindByCriteriaQuery)
export class PaymentFindByCriteriaQueryHandler implements IQueryHandler<
  PaymentFindByCriteriaQuery,
  PaginatedResult<PaymentViewModel>
> {
  private readonly logger = new Logger(PaymentFindByCriteriaQueryHandler.name);

  constructor(
    @Inject(PAYMENT_READ_REPOSITORY)
    private readonly paymentReadRepository: IPaymentReadRepository,
  ) {}

  async execute(
    query: PaymentFindByCriteriaQuery,
  ): Promise<PaginatedResult<PaymentViewModel>> {
    this.logger.log('Executing PaymentFindByCriteriaQuery');
    return this.paymentReadRepository.findByCriteria(query.criteria);
  }
}
