import { Repository } from 'typeorm';

import { NoTenantContextException } from '@core/tenancy/application/exceptions/no-tenant-context.exception';
import { TenantContextService } from '@core/tenancy/application/services/tenant-context.service';
import { createTenantScopedRepository } from './create-tenant-scoped-repository.factory';

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440001';

interface TestEntity {
  id: string;
  tenantId: string;
  name: string;
}

const buildMockRepository = (): jest.Mocked<Repository<TestEntity>> =>
  ({
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  }) as unknown as jest.Mocked<Repository<TestEntity>>;

describe('createTenantScopedRepository', () => {
  let mockRepository: jest.Mocked<Repository<TestEntity>>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository = buildMockRepository();
  });

  describe('findOne()', () => {
    it('merges the current tenant id into the where clause', async () => {
      const tenantContextService = new TenantContextService();
      const scoped = createTenantScopedRepository(
        mockRepository,
        tenantContextService,
      );

      await tenantContextService.run(TENANT_ID, () =>
        scoped.findOne({ where: { name: 'test' } } as any),
      );

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'test', tenantId: TENANT_ID },
      });
    });

    it('throws NoTenantContextException when no tenant context is present', () => {
      const tenantContextService = new TenantContextService();
      const scoped = createTenantScopedRepository(
        mockRepository,
        tenantContextService,
      );

      expect(() => scoped.findOne({} as any)).toThrow(NoTenantContextException);
      expect(mockRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('find()', () => {
    it('merges the current tenant id into the where clause', async () => {
      const tenantContextService = new TenantContextService();
      const scoped = createTenantScopedRepository(
        mockRepository,
        tenantContextService,
      );

      await tenantContextService.run(TENANT_ID, () =>
        scoped.find({ where: { name: 'test' } } as any),
      );

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { name: 'test', tenantId: TENANT_ID },
      });
    });

    it('throws NoTenantContextException when no tenant context is present', () => {
      const tenantContextService = new TenantContextService();
      const scoped = createTenantScopedRepository(
        mockRepository,
        tenantContextService,
      );

      expect(() => scoped.find({} as any)).toThrow(NoTenantContextException);
      expect(mockRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('findAndCount()', () => {
    it('merges the current tenant id into the where clause', async () => {
      const tenantContextService = new TenantContextService();
      const scoped = createTenantScopedRepository(
        mockRepository,
        tenantContextService,
      );

      await tenantContextService.run(TENANT_ID, () =>
        scoped.findAndCount({ where: { name: 'test' } } as any),
      );

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { name: 'test', tenantId: TENANT_ID },
      });
    });

    it('throws NoTenantContextException when no tenant context is present', () => {
      const tenantContextService = new TenantContextService();
      const scoped = createTenantScopedRepository(
        mockRepository,
        tenantContextService,
      );

      expect(() => scoped.findAndCount({} as any)).toThrow(
        NoTenantContextException,
      );
      expect(mockRepository.findAndCount).not.toHaveBeenCalled();
    });
  });

  describe('save()', () => {
    it('stamps the current tenant id onto the entity', async () => {
      const tenantContextService = new TenantContextService();
      const scoped = createTenantScopedRepository(
        mockRepository,
        tenantContextService,
      );
      const entity: TestEntity = { id: '1', tenantId: '', name: 'test' };
      mockRepository.save.mockResolvedValue({
        ...entity,
        tenantId: TENANT_ID,
      } as any);

      await tenantContextService.run(TENANT_ID, () =>
        scoped.save(entity as any),
      );

      expect(mockRepository.save).toHaveBeenCalledWith({
        ...entity,
        tenantId: TENANT_ID,
      });
    });

    it('throws NoTenantContextException when no tenant context is present', () => {
      const tenantContextService = new TenantContextService();
      const scoped = createTenantScopedRepository(
        mockRepository,
        tenantContextService,
      );
      const entity: TestEntity = { id: '1', tenantId: '', name: 'test' };

      expect(() => scoped.save(entity as any)).toThrow(
        NoTenantContextException,
      );
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('delete()', () => {
    it('merges the current tenant id into the criteria', async () => {
      const tenantContextService = new TenantContextService();
      const scoped = createTenantScopedRepository(
        mockRepository,
        tenantContextService,
      );

      await tenantContextService.run(TENANT_ID, () =>
        scoped.delete({ id: '1' } as any),
      );

      expect(mockRepository.delete).toHaveBeenCalledWith({
        id: '1',
        tenantId: TENANT_ID,
      });
    });

    it('accepts a bare id and merges the current tenant id', async () => {
      const tenantContextService = new TenantContextService();
      const scoped = createTenantScopedRepository(
        mockRepository,
        tenantContextService,
      );

      await tenantContextService.run(TENANT_ID, () => scoped.delete('1'));

      expect(mockRepository.delete).toHaveBeenCalledWith({
        id: '1',
        tenantId: TENANT_ID,
      });
    });

    it('throws NoTenantContextException when no tenant context is present', () => {
      const tenantContextService = new TenantContextService();
      const scoped = createTenantScopedRepository(
        mockRepository,
        tenantContextService,
      );

      expect(() => scoped.delete({ id: '1' } as any)).toThrow(
        NoTenantContextException,
      );
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('unintercepted methods', () => {
    it('passes count() straight through to the underlying repository, even with no tenant context', async () => {
      const tenantContextService = new TenantContextService();
      const scoped = createTenantScopedRepository(
        mockRepository,
        tenantContextService,
      );
      mockRepository.count.mockResolvedValue(5);

      const result = await scoped.count({} as any);

      expect(mockRepository.count).toHaveBeenCalledTimes(1);
      expect(result).toBe(5);
    });
  });
});
