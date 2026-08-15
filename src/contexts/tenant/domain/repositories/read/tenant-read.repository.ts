import { IBaseReadRepository } from '@sisques-labs/nestjs-kit';
import { TenantViewModel } from '@contexts/tenant/domain/view-models/tenant.view-model';

/**
 * Read-side port for `Tenant`. Implemented by
 * `infrastructure/persistence/typeorm/repositories/tenant-typeorm-read.repository.ts`.
 *
 * A type alias rather than an `interface extends {}` — `Tenant` needs no
 * read methods beyond the base contract, and an empty-bodied interface
 * extension is rejected by `@typescript-eslint/no-empty-object-type`.
 */
export type ITenantReadRepository = IBaseReadRepository<TenantViewModel>;

/** DI token for `ITenantReadRepository`. */
export const TENANT_READ_REPOSITORY = Symbol('TENANT_READ_REPOSITORY');
