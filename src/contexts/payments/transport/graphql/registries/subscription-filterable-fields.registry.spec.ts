import { SubscriptionStatusEnum } from '@contexts/payments/domain/enums/subscription-status.enum';
import { SubscriptionQueryableField } from '@contexts/payments/transport/graphql/enums/subscription-queryable-field.enum';

import { subscriptionFilterableFields } from './subscription-filterable-fields.registry';

describe('subscriptionFilterableFields', () => {
  it('has a registry entry for every SubscriptionQueryableField value', () => {
    for (const field of Object.values(SubscriptionQueryableField)) {
      expect(subscriptionFilterableFields[field]).toBeDefined();
    }
  });

  it('registers status as an enum backed by SubscriptionStatusEnum', () => {
    expect(
      subscriptionFilterableFields[SubscriptionQueryableField.STATUS],
    ).toEqual({
      type: 'enum',
      enum: SubscriptionStatusEnum,
    });
  });

  it('rejects a field outside the whitelist', () => {
    expect(
      (subscriptionFilterableFields as Record<string, unknown>).priceId,
    ).toBeUndefined();
  });
});
