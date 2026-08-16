import { InputType } from '@nestjs/graphql';
import { createFilterInput } from '@sisques-labs/nestjs-kit/graphql';

import { SubscriptionQueryableField } from '@contexts/payments/transport/graphql/enums/subscription-queryable-field.enum';

@InputType('SubscriptionFilterInput')
export class SubscriptionFilterInput extends createFilterInput(
  SubscriptionQueryableField,
  'Subscription',
) {}
