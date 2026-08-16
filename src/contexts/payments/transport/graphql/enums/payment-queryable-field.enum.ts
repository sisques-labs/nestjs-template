/**
 * Whitelist of `Payment` fields a client can filter/sort by via
 * `paymentsFindByCriteria`. Transport-only — not a domain concept.
 */
export enum PaymentQueryableField {
  ID = 'id',
  STATUS = 'status',
  CUSTOMER_ID = 'customerId',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}
