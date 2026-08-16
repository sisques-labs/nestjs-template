import { IBaseWriteRepository } from '@sisques-labs/nestjs-kit';

import { PaymentAggregate } from '@contexts/payments/domain/aggregates/payment.aggregate';

export const PAYMENT_WRITE_REPOSITORY = Symbol('PAYMENT_WRITE_REPOSITORY');

export interface IPaymentWriteRepository extends IBaseWriteRepository<PaymentAggregate> {
  /** Backs `CreatePayment`'s idempotent-retry check. */
  findByIdempotencyKey(
    provider: string,
    idempotencyKey: string,
  ): Promise<PaymentAggregate | null>;
}
