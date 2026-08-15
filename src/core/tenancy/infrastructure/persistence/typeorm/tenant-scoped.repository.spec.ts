import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';

import { TenantContextService } from '../../../application/services/tenant-context.service';
import { TenantScopedRepository } from './tenant-scoped.repository';

interface TestEntity extends ObjectLiteral {
  id: string;
  tenantId: string;
}

/**
 * Minimal concrete subclass exposing the protected
 * `tenantScopedQueryBuilder` for assertions — mirrors how a future
 * context's TypeORM repository would call it internally (e.g. from its own
 * `findByCriteria`).
 */
class TestTenantScopedRepository extends TenantScopedRepository {
  query(repository: Repository<TestEntity>): SelectQueryBuilder<TestEntity> {
    return this.tenantScopedQueryBuilder(repository, 'test');
  }
}

/**
 * Lightweight fake standing in for TypeORM's `SelectQueryBuilder`: real
 * enough to prove `.andWhere(...)` was called with the tenant filter and
 * to make `.getQuery()`/`.getParameters()` inspectable, without a live DB
 * connection.
 */
interface FakeQueryBuilder {
  andWhere: jest.Mock<FakeQueryBuilder, [string, Record<string, unknown>?]>;
  getQuery: () => string;
  getParameters: () => Record<string, unknown>;
}

function buildFakeQueryBuilder(): FakeQueryBuilder {
  const conditions: string[] = [];
  let parameters: Record<string, unknown> = {};

  const builder: FakeQueryBuilder = {
    andWhere: jest.fn((condition: string, params?: Record<string, unknown>) => {
      conditions.push(condition);
      parameters = { ...parameters, ...params };
      return builder;
    }),
    getQuery: () => `SELECT * FROM test WHERE ${conditions.join(' AND ')}`,
    getParameters: () => parameters,
  };

  return builder;
}

function buildMockRepository(
  queryBuilder: FakeQueryBuilder,
): jest.Mocked<Repository<TestEntity>> {
  return {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
  } as unknown as jest.Mocked<Repository<TestEntity>>;
}

describe('TenantScopedRepository', () => {
  describe('query within a guarded request', () => {
    it('applies the tenant filter to the generated SQL and parameters', () => {
      // Real TenantContextService.run() rather than a mock — this is the
      // exact propagation mechanism TenantContextInterceptor relies on, so
      // exercising it here (instead of a jest.Mocked get()) covers that the
      // base class reads it correctly, not just that a mock was configured
      // correctly.
      const tenantContextService = new TenantContextService();
      const repository = new TestTenantScopedRepository(tenantContextService);
      const queryBuilder = buildFakeQueryBuilder();
      const mockRepository = buildMockRepository(queryBuilder);

      const result = tenantContextService.run('t-1', () =>
        repository.query(mockRepository),
      );

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('test');
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'test.tenantId = :tenantId',
        { tenantId: 't-1' },
      );
      expect(result.getQuery()).toContain('test.tenantId = :tenantId');
      expect(result.getParameters()).toEqual({ tenantId: 't-1' });
    });
  });

  describe('query with no tenant context present', () => {
    it('throws before ever calling Repository.createQueryBuilder', () => {
      const tenantContextService = new TenantContextService();
      const repository = new TestTenantScopedRepository(tenantContextService);
      const queryBuilder = buildFakeQueryBuilder();
      const mockRepository = buildMockRepository(queryBuilder);

      expect(() => repository.query(mockRepository)).toThrow(
        /no tenant context/i,
      );
      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
