import { InputType } from '@nestjs/graphql';
import { createFilterInput } from '@sisques-labs/nestjs-kit/graphql';

import { PaymentQueryableField } from '@contexts/payments/transport/graphql/enums/payment-queryable-field.enum';

@InputType('PaymentFilterInput')
export class PaymentFilterInput extends createFilterInput(
  PaymentQueryableField,
  'Payment',
) {}
