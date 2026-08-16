import { Injectable } from '@nestjs/common';
import { BaseDatabaseRepository } from '@sisques-labs/nestjs-kit';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';

import { TenantContextService } from '../../../application/services/tenant-context.service';
import { NoTenantContextException } from '../../exceptions/no-tenant-context.exception';

/**
 * Abstract base class for TypeORM repositories that must never return rows
 * belonging to a tenant other than the current request's. A future bounded
 * context's read/write repository extends this instead of extending
 * `BaseDatabaseRepository` directly (same as
 * `TenantTypeOrmWriteRepository`/`TenantTypeOrmReadRepository` in
 * `src/contexts/tenant/` extend `BaseDatabaseRepository` — see those files
 * for why this template composes an `@InjectRepository`-supplied
 * `Repository<Entity>` rather than extending
 * `BaseTypeormMasterRepository`). Subclasses inherit `calculatePagination`
 * (and any other `BaseDatabaseRepository` helper) for free, exactly as
 * those two repositories do today.
 *
 * **Convention every entity extending this relies on**: the entity must
 * expose a `tenantId: string` property (mapped via `@Column({ name: '...' })`
 * to whatever the actual DB column is, e.g. `tenant_id`). `ObjectLiteral`
 * (the constraint TypeORM itself puts on `Repository`/`SelectQueryBuilder`)
 * carries no field information, so nothing in the type system enforces
 * this — it's a repo-wide convention documented here and in
 * `src/core/tenancy/README.md`, the same way other cross-context
 * conventions in this template are enforced by documentation/review rather
 * than generics.
 *
 * No context in this template extends this yet — `src/contexts/tenant/`'s
 * own repositories intentionally do NOT: the `tenants` table has no
 * `tenant_id` column, since a `Tenant` row IS the tenant, not something
 * scoped to one.
 */
@Injectable()
export abstract class TenantScopedRepository extends BaseDatabaseRepository {
  constructor(protected readonly tenantContextService: TenantContextService) {
    super();
  }

  /**
   * Builds a `SelectQueryBuilder` for `repository` under `alias`, with the
   * current tenant's filter already applied as
   * `{alias}.tenantId = :tenantId` (a TypeORM entity property path, not a
   * raw SQL column name — TypeORM translates it to the mapped column at
   * query-build time).
   *
   * Throws immediately, before building or returning any query builder, if
   * `TenantContextService.get()` has no tenant id — e.g. this method was
   * called from outside a request guarded by `TenantGuard` +
   * `TenantContextInterceptor` (a background job, a misconfigured route).
   * Returning an unscoped query builder in that case would silently leak
   * every tenant's rows to whatever called it, so this fails loudly
   * instead.
   */
  protected tenantScopedQueryBuilder<Entity extends ObjectLiteral>(
    repository: Repository<Entity>,
    alias: string,
  ): SelectQueryBuilder<Entity> {
    const tenantId = this.tenantContextService.get();

    if (!tenantId) {
      throw new NoTenantContextException();
    }

    return repository
      .createQueryBuilder(alias)
      .andWhere(`${alias}.tenantId = :tenantId`, { tenantId });
  }
}
