import { DateValueObject } from '@sisques-labs/nestjs-kit';
import { TenantAggregate } from '@contexts/tenant/domain/aggregates/tenant.aggregate';
import { TenantCreatedEvent } from '@contexts/tenant/domain/events/tenant-created/tenant-created.event';
import { ITenant } from '@contexts/tenant/domain/interfaces/tenant.interface';
import { TenantExternalIdValueObject } from '@contexts/tenant/domain/value-objects/tenant-external-id/tenant-external-id.vo';
import { TenantIdValueObject } from '@contexts/tenant/domain/value-objects/tenant-id/tenant-id.vo';

const VALID_UUID = '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');
const UPDATED_AT = new Date('2026-01-01T00:00:00.000Z');

function buildTenant(overrides: Partial<ITenant> = {}): ITenant {
  return {
    id: new TenantIdValueObject(VALID_UUID),
    externalId: new TenantExternalIdValueObject('idp-tenant-external-id'),
    createdAt: new DateValueObject(CREATED_AT),
    updatedAt: new DateValueObject(UPDATED_AT),
    ...overrides,
  };
}

describe('TenantAggregate', () => {
  describe('constructor', () => {
    it('hydrates fields from an already-VO-wrapped ITenant without emitting any events', () => {
      const tenant = new TenantAggregate(buildTenant());

      expect(tenant.id.value).toBe(VALID_UUID);
      expect(tenant.externalId.value).toBe('idp-tenant-external-id');
      expect(tenant.toPrimitives()).toEqual({
        id: VALID_UUID,
        externalId: 'idp-tenant-external-id',
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      });
      expect(tenant.getUncommittedEvents()).toHaveLength(0);
    });

    it('rejects an invalid id', () => {
      expect(
        () =>
          new TenantAggregate(
            buildTenant({ id: new TenantIdValueObject('not-a-uuid') }),
          ),
      ).toThrow();
    });

    it('rejects an empty externalId', () => {
      expect(
        () =>
          new TenantAggregate(
            buildTenant({ externalId: new TenantExternalIdValueObject('') }),
          ),
      ).toThrow();
    });
  });

  describe('create', () => {
    it('emits a single TenantCreatedEvent carrying the aggregate primitives', () => {
      const tenant = new TenantAggregate(buildTenant());

      tenant.create();

      const events = tenant.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(TenantCreatedEvent);
      expect((events[0] as TenantCreatedEvent).data).toEqual(
        tenant.toPrimitives(),
      );
    });
  });
});
