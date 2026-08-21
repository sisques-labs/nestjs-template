import { Repository } from 'typeorm';

import { TenantContextService } from '@core/tenancy/application/services/tenant-context.service';

/**
 * Wraps `repository` in a `Proxy` that transparently scopes `findOne`,
 * `find`, `findAndCount`, `save`, and `delete` to the current tenant —
 * `TenantContextService.require()` supplies the tenant id (throwing
 * `NoTenantContextException` if called outside a request scoped by
 * `TenantGuard` + `TenantContextInterceptor`, rather than risk an unscoped
 * query that could leak every tenant's rows).
 *
 * A future bounded context's TypeORM repository calls this once, in its
 * constructor, on the `@InjectRepository`-supplied `Repository<Entity>`,
 * and then just uses the returned repository normally — no special
 * tenant-aware method to remember to call at each query site.
 *
 * **`createQueryBuilder()` bypasses this proxy** — TypeORM's query builder
 * is built from the underlying repository/connection, not intercepted by
 * `Proxy` traps on `find*`/`save`/`delete`. Any repository method that uses
 * `createQueryBuilder()` (e.g. criteria-based pagination) must apply the
 * tenant filter explicitly: `.andWhere('{alias}.tenantId = :tenantId', {
 * tenantId: tenantContextService.require() })`.
 *
 * **Convention this depends on**: `Entity` must have a `tenantId: string`
 * property (mapped via `@Column({ name: '...' })` to whatever the actual DB
 * column is, e.g. `tenant_id`) — the same convention documented in
 * `src/core/tenancy/README.md`.
 */
export function createTenantScopedRepository<
  Entity extends { tenantId: string },
>(
  repository: Repository<Entity>,
  tenantContextService: TenantContextService,
): Repository<Entity> {
  return new Proxy(repository, {
    get(target, prop, receiver) {
      if (prop === 'findOne' || prop === 'find' || prop === 'findAndCount') {
        return (options: Record<string, unknown> = {}) =>
          (target as any)[prop]({
            ...options,
            where: {
              ...(options.where as Record<string, unknown> | undefined),
              tenantId: tenantContextService.require(),
            },
          });
      }

      if (prop === 'save') {
        return (entity: Partial<Entity>) =>
          target.save({
            ...entity,
            tenantId: tenantContextService.require(),
          } as Entity);
      }

      if (prop === 'delete') {
        return (criteria: string | number | Record<string, unknown>) => {
          const where =
            typeof criteria === 'string' || typeof criteria === 'number'
              ? { id: criteria, tenantId: tenantContextService.require() }
              : { ...criteria, tenantId: tenantContextService.require() };
          return target.delete(where as any);
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  });
}
