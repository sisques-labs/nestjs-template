import { TenantAggregate } from '@contexts/tenant/domain/aggregates/tenant.aggregate';
import { TenantCreatedEvent } from '@contexts/tenant/domain/events/tenant-created/tenant-created.event';
import { TenantPrimitives } from '@contexts/tenant/domain/primitives/tenant.primitives';

const VALID_UUID = '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11';

function buildPrimitives(
  overrides: Partial<TenantPrimitives> = {},
): TenantPrimitives {
  return {
    id: VALID_UUID,
    externalId: 'idp-tenant-external-id',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('TenantAggregate', () => {
  describe('constructor', () => {
    it('hydrates fields from primitives without emitting any events', () => {
      const primitives = buildPrimitives();

      const tenant = new TenantAggregate(primitives);

      expect(tenant.id.value).toBe(primitives.id);
      expect(tenant.externalId.value).toBe(primitives.externalId);
      expect(tenant.toPrimitives()).toEqual(primitives);
      expect(tenant.getUncommittedEvents()).toHaveLength(0);
    });

    it('rejects an invalid id', () => {
      expect(
        () => new TenantAggregate(buildPrimitives({ id: 'not-a-uuid' })),
      ).toThrow();
    });

    it('rejects an empty externalId', () => {
      expect(
        () => new TenantAggregate(buildPrimitives({ externalId: '' })),
      ).toThrow();
    });
  });

  describe('create', () => {
    it('emits a single TenantCreatedEvent carrying the aggregate primitives', () => {
      const primitives = buildPrimitives();
      const tenant = new TenantAggregate(primitives);

      tenant.create();

      const events = tenant.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(TenantCreatedEvent);
      expect((events[0] as TenantCreatedEvent).data).toEqual(primitives);
    });
  });
});
