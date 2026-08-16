import {
  BooleanValueObject,
  DateValueObject,
  JsonValueObject,
  StringValueObject,
} from '@sisques-labs/nestjs-kit';

import { SubscriptionIdValueObject } from '@contexts/payments/domain/value-objects/subscription-id/subscription-id.value-object';
import { PaymentProviderValueObject } from '@contexts/payments/domain/value-objects/payment-provider/payment-provider.value-object';
import { SubscriptionStatusValueObject } from '@contexts/payments/domain/value-objects/subscription-status/subscription-status.value-object';
import { IdempotencyKeyValueObject } from '@contexts/payments/domain/value-objects/idempotency-key/idempotency-key.value-object';

export interface ISubscription {
  id: SubscriptionIdValueObject;
  provider: PaymentProviderValueObject;
  providerSubscriptionId?: StringValueObject;
  providerCustomerId?: StringValueObject;
  customerId: StringValueObject;
  priceId: StringValueObject;
  status: SubscriptionStatusValueObject;
  currentPeriodStart?: DateValueObject;
  currentPeriodEnd?: DateValueObject;
  cancelAtPeriodEnd: BooleanValueObject;
  idempotencyKey: IdempotencyKeyValueObject;
  metadata?: JsonValueObject;
  createdAt: DateValueObject;
  updatedAt: DateValueObject;
}
