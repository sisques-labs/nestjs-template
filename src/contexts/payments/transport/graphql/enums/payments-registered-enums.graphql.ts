import { registerEnumType } from '@nestjs/graphql';

import { CurrencyEnum } from '@contexts/payments/domain/enums/currency.enum';
import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { PaymentStatusEnum } from '@contexts/payments/domain/enums/payment-status.enum';
import { SubscriptionStatusEnum } from '@contexts/payments/domain/enums/subscription-status.enum';
import { PaymentQueryableField } from '@contexts/payments/transport/graphql/enums/payment-queryable-field.enum';
import { SubscriptionQueryableField } from '@contexts/payments/transport/graphql/enums/subscription-queryable-field.enum';

registerEnumType(PaymentProviderEnum, {
  name: 'PaymentProviderEnum',
  description: 'Payment provider backing a Payment or Subscription',
});

registerEnumType(CurrencyEnum, {
  name: 'CurrencyEnum',
  description: 'ISO 4217 currency code',
});

registerEnumType(PaymentStatusEnum, {
  name: 'PaymentStatusEnum',
  description: 'Lifecycle status of a Payment',
});

registerEnumType(SubscriptionStatusEnum, {
  name: 'SubscriptionStatusEnum',
  description: 'Lifecycle status of a Subscription',
});

registerEnumType(PaymentQueryableField, {
  name: 'PaymentQueryableFieldEnum',
  description: 'The payment fields that can be filtered/sorted on',
});

registerEnumType(SubscriptionQueryableField, {
  name: 'SubscriptionQueryableFieldEnum',
  description: 'The subscription fields that can be filtered/sorted on',
});
