import { IBaseReadRepository } from '@sisques-labs/nestjs-kit';

import { PaymentViewModel } from '@contexts/payments/domain/view-models/payment.view-model';

export const PAYMENT_READ_REPOSITORY = Symbol('PAYMENT_READ_REPOSITORY');

export type IPaymentReadRepository = IBaseReadRepository<PaymentViewModel>;
