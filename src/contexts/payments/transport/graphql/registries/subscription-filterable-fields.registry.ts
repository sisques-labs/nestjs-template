import { FilterFieldRegistry } from '@sisques-labs/nestjs-kit';

import { SubscriptionStatusEnum } from '@contexts/payments/domain/enums/subscription-status.enum';
import { SubscriptionQueryableField } from '@contexts/payments/transport/graphql/enums/subscription-queryable-field.enum';

export const subscriptionFilterableFields: FilterFieldRegistry<SubscriptionQueryableField> =
  {
    [SubscriptionQueryableField.ID]: { type: 'uuid' },
    [SubscriptionQueryableField.STATUS]: {
      type: 'enum',
      enum: SubscriptionStatusEnum,
    },
    [SubscriptionQueryableField.CUSTOMER_ID]: { type: 'string' },
    [SubscriptionQueryableField.CREATED_AT]: { type: 'date' },
    [SubscriptionQueryableField.UPDATED_AT]: { type: 'date' },
  };
