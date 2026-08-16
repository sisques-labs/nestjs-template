import { FilterFieldRegistry } from '@sisques-labs/nestjs-kit';

import { PaymentStatusEnum } from '@contexts/payments/domain/enums/payment-status.enum';
import { PaymentQueryableField } from '@contexts/payments/transport/graphql/enums/payment-queryable-field.enum';

export const paymentFilterableFields: FilterFieldRegistry<PaymentQueryableField> =
  {
    [PaymentQueryableField.ID]: { type: 'uuid' },
    [PaymentQueryableField.STATUS]: { type: 'enum', enum: PaymentStatusEnum },
    [PaymentQueryableField.CUSTOMER_ID]: { type: 'string' },
    [PaymentQueryableField.CREATED_AT]: { type: 'date' },
    [PaymentQueryableField.UPDATED_AT]: { type: 'date' },
  };
