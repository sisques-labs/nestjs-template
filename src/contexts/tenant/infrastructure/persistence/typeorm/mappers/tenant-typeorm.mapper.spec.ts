import { TenantBuilder } from '@contexts/tenant/domain/builders/tenant.builder';
import { TenantEntity } from '@contexts/tenant/infrastructure/persistence/typeorm/entities/tenant.entity';
import { TenantTypeOrmMapper } from '@contexts/tenant/infrastructure/persistence/typeorm/mappers/tenant-typeorm.mapper';

function buildEntity(overrides: Partial<TenantEntity> = {}): TenantEntity {
  const entity = new TenantEntity();
  entity.id = '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11';
  entity.externalId = 'idp-tenant-external-id';
  entity.createdAt = new Date('2026-01-01T00:00:00.000Z');
  entity.updatedAt = new Date('2026-01-01T00:00:00.000Z');
  return Object.assign(entity, overrides);
}

describe('TenantTypeOrmMapper', () => {
  let mapper: TenantTypeOrmMapper;

  beforeEach(() => {
    mapper = new TenantTypeOrmMapper(new TenantBuilder());
  });

  describe('toAggregate', () => {
    it('maps a TenantEntity to a TenantAggregate', () => {
      const entity = buildEntity();

      const aggregate = mapper.toAggregate(entity);

      expect(aggregate.id.value).toBe(entity.id);
      expect(aggregate.externalId.value).toBe(entity.externalId);
      expect(aggregate.createdAt.value).toEqual(entity.createdAt);
      expect(aggregate.updatedAt.value).toEqual(entity.updatedAt);
    });

    /**
     * Directly exercises the "is reusing a single injected TenantBuilder
     * instance across calls safe" concern from the review comment asking
     * for constructor injection: every `.withX()` call fully overwrites its
     * field before `build()`, so back-to-back calls on the same mapper
     * (and therefore the same injected builder) must not leak state
     * between them.
     */
    it('produces two independently-correct aggregates across repeated calls on the same injected TenantBuilder instance', () => {
      const first = buildEntity({
        id: '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11',
        externalId: 'first-external-id',
      });
      const second = buildEntity({
        id: '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a12',
        externalId: 'second-external-id',
      });

      const firstAggregate = mapper.toAggregate(first);
      const secondAggregate = mapper.toAggregate(second);

      expect(firstAggregate.id.value).toBe(first.id);
      expect(firstAggregate.externalId.value).toBe(first.externalId);
      expect(secondAggregate.id.value).toBe(second.id);
      expect(secondAggregate.externalId.value).toBe(second.externalId);
    });
  });

  describe('toPersistence', () => {
    it('maps a TenantAggregate to a TenantEntity', () => {
      const aggregate = new TenantBuilder()
        .withId('5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11')
        .withExternalId('idp-tenant-external-id')
        .withCreatedAt(new Date('2026-01-01T00:00:00.000Z'))
        .withUpdatedAt(new Date('2026-01-01T00:00:00.000Z'))
        .build();

      const entity = mapper.toPersistence(aggregate);

      expect(entity.id).toBe(aggregate.id.value);
      expect(entity.externalId).toBe(aggregate.externalId.value);
      expect(entity.createdAt).toEqual(aggregate.createdAt.value);
      expect(entity.updatedAt).toEqual(aggregate.updatedAt.value);
    });
  });

  describe('toViewModel', () => {
    it('maps a TenantEntity to a TenantViewModel', () => {
      const entity = buildEntity();

      const viewModel = mapper.toViewModel(entity);

      expect(viewModel.id).toBe(entity.id);
      expect(viewModel.externalId).toBe(entity.externalId);
      expect(viewModel.createdAt).toEqual(entity.createdAt);
      expect(viewModel.updatedAt).toEqual(entity.updatedAt);
    });
  });
});
