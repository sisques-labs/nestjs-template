import { InputType } from '@nestjs/graphql';
import { createSortInput } from '@sisques-labs/nestjs-kit/graphql';

import { SubscriptionQueryableField } from '@contexts/payments/transport/graphql/enums/subscription-queryable-field.enum';

@InputType('SubscriptionSortInput')
export class SubscriptionSortInput extends createSortInput(
  SubscriptionQueryableField,
  'Subscription',
) {}
