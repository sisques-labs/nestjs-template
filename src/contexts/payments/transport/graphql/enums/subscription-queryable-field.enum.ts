/**
 * Whitelist of `Subscription` fields a client can filter/sort by via
 * `subscriptionsFindByCriteria`. Transport-only — not a domain concept.
 */
export enum SubscriptionQueryableField {
  ID = 'id',
  STATUS = 'status',
  CUSTOMER_ID = 'customerId',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}
