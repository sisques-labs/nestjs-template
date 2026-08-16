import { IBaseReadRepository } from '@sisques-labs/nestjs-kit';

import { SubscriptionViewModel } from '@contexts/payments/domain/view-models/subscription.view-model';

export const SUBSCRIPTION_READ_REPOSITORY = Symbol(
  'SUBSCRIPTION_READ_REPOSITORY',
);

export type ISubscriptionReadRepository =
  IBaseReadRepository<SubscriptionViewModel>;
