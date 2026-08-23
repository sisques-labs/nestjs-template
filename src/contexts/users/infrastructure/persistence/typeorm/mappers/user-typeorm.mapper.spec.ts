import { UserBuilder } from '@contexts/users/domain/builders/user.builder';
import { UserEntity } from '@contexts/users/infrastructure/persistence/typeorm/entities/user.entity';
import { UserTypeOrmMapper } from '@contexts/users/infrastructure/persistence/typeorm/mappers/user-typeorm.mapper';

function buildEntity(overrides: Partial<UserEntity> = {}): UserEntity {
  const entity = new UserEntity();
  entity.id = '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11';
  entity.tenantId = '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a12';
  entity.externalId = 'sub-42';
  entity.email = 'alice@example.com';
  entity.displayName = 'Alice';
  entity.createdAt = new Date('2026-01-01T00:00:00.000Z');
  entity.updatedAt = new Date('2026-01-01T00:00:00.000Z');
  return Object.assign(entity, overrides);
}

describe('UserTypeOrmMapper', () => {
  let mapper: UserTypeOrmMapper;

  beforeEach(() => {
    mapper = new UserTypeOrmMapper(new UserBuilder());
  });

  describe('toAggregate', () => {
    it('maps a UserEntity to a UserAggregate', () => {
      const entity = buildEntity();

      const aggregate = mapper.toAggregate(entity);

      expect(aggregate.id.value).toBe(entity.id);
      expect(aggregate.tenantId.value).toBe(entity.tenantId);
      expect(aggregate.externalId.value).toBe(entity.externalId);
      expect(aggregate.email?.value).toBe(entity.email);
      expect(aggregate.displayName.value).toBe(entity.displayName);
      expect(aggregate.createdAt.value).toEqual(entity.createdAt);
      expect(aggregate.updatedAt.value).toEqual(entity.updatedAt);
    });

    it('maps a null email through to the aggregate', () => {
      const entity = buildEntity({ email: null });

      const aggregate = mapper.toAggregate(entity);

      expect(aggregate.email).toBeNull();
    });

    /** Same reused-builder-instance safety concern verified for `TenantTypeOrmMapper`
     * — see that mapper's spec. */
    it('produces two independently-correct aggregates across repeated calls on the same injected UserBuilder instance', () => {
      const first = buildEntity({
        id: '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11',
        externalId: 'first-sub',
      });
      const second = buildEntity({
        id: '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a13',
        externalId: 'second-sub',
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
    it('maps a UserAggregate to a UserEntity', () => {
      const aggregate = new UserBuilder()
        .withId('5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11')
        .withTenantId('5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a12')
        .withExternalId('sub-42')
        .withEmail('alice@example.com')
        .withDisplayName('Alice')
        .withCreatedAt(new Date('2026-01-01T00:00:00.000Z'))
        .withUpdatedAt(new Date('2026-01-01T00:00:00.000Z'))
        .build();

      const entity = mapper.toPersistence(aggregate);

      expect(entity.id).toBe(aggregate.id.value);
      expect(entity.tenantId).toBe(aggregate.tenantId.value);
      expect(entity.externalId).toBe(aggregate.externalId.value);
      expect(entity.email).toBe(aggregate.email?.value);
      expect(entity.displayName).toBe(aggregate.displayName.value);
      expect(entity.createdAt).toEqual(aggregate.createdAt.value);
      expect(entity.updatedAt).toEqual(aggregate.updatedAt.value);
    });
  });

  describe('toViewModel', () => {
    it('maps a UserEntity to a UserViewModel', () => {
      const entity = buildEntity();

      const viewModel = mapper.toViewModel(entity);

      expect(viewModel.id).toBe(entity.id);
      expect(viewModel.tenantId).toBe(entity.tenantId);
      expect(viewModel.externalId).toBe(entity.externalId);
      expect(viewModel.email).toBe(entity.email);
      expect(viewModel.displayName).toBe(entity.displayName);
      expect(viewModel.createdAt).toEqual(entity.createdAt);
      expect(viewModel.updatedAt).toEqual(entity.updatedAt);
    });
  });
});
