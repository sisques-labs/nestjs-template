import { InputType } from '@nestjs/graphql';
import { createSortInput } from '@sisques-labs/nestjs-kit/graphql';

import { PaymentQueryableField } from '@contexts/payments/transport/graphql/enums/payment-queryable-field.enum';

@InputType('PaymentSortInput')
export class PaymentSortInput extends createSortInput(
  PaymentQueryableField,
  'Payment',
) {}
