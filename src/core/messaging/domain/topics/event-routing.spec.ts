import {
  deriveAction,
  resolveModule,
} from '@core/messaging/domain/topics/event-routing';

describe('event-routing', () => {
  describe('resolveModule', () => {
    it('falls back to the unmapped module when the aggregate map is empty', () => {
      // AGGREGATE_MODULE_MAP is auto-generated from src/contexts/*/domain/aggregates —
      // empty in this template until the first bounded context is added.
      expect(resolveModule('OrderAggregate')).toEqual({
        module: 'unmapped',
        fallback: true,
      });
    });

    it('falls back to the unmapped module for unknown aggregate types', () => {
      expect(resolveModule('SomethingNewAggregate')).toEqual({
        module: 'unmapped',
        fallback: true,
      });
    });
  });

  describe('deriveAction', () => {
    it.each([
      ['OrderCreatedEvent', 'order-created'],
      ['OrderUpdatedEvent', 'order-updated'],
      ['OrderStatusChangedEvent', 'order-status-changed'],
      ['UserCreationFailedEvent', 'user-creation-failed'],
      ['OAuthIdentityLinkedEvent', 'o-auth-identity-linked'],
    ])('kebab-cases %s -> %s', (eventType, expected) => {
      expect(deriveAction(eventType)).toBe(expected);
    });
  });
});
