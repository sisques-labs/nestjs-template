import { IBaseWriteRepository } from '@sisques-labs/nestjs-kit';

import { SubscriptionAggregate } from '@contexts/payments/domain/aggregates/subscription.aggregate';

export const SUBSCRIPTION_WRITE_REPOSITORY = Symbol(
  'SUBSCRIPTION_WRITE_REPOSITORY',
);

export interface ISubscriptionWriteRepository extends IBaseWriteRepository<SubscriptionAggregate> {
  /** Backs `CreateSubscription`'s idempotent-retry check. */
  findByIdempotencyKey(
    provider: string,
    idempotencyKey: string,
  ): Promise<SubscriptionAggregate | null>;
}
