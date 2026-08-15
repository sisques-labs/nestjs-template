import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { TenantContextService } from './application/services/tenant-context.service';
import { TenantContextInterceptor } from './infrastructure/interceptors/tenant-context.interceptor';
import { TenantGuard } from './infrastructure/guards/tenant.guard';

const APPLICATION_SERVICES = [TenantContextService];
const INFRASTRUCTURE_GUARDS = [TenantGuard];
const INFRASTRUCTURE_INTERCEPTORS = [TenantContextInterceptor];

/**
 * Cross-cutting tenancy enforcement — not a bounded context, wired directly
 * into `CORE_MODULES` (see `core.module.ts`), not `CONTEXT_MODULES`.
 * `TenantGuard`/`TenantContextInterceptor`/`TenantContextService` are
 * exported for opt-in use on whichever controllers/resolvers a service
 * adds — they are not applied globally. Always pair the guard with the
 * interceptor: `@UseGuards(IdentityGuard, TenantGuard)
 * @UseInterceptors(TenantContextInterceptor)` — see `tenant.guard.ts` and
 * `tenant-context.interceptor.ts` for why it takes both.
 *
 * Unlike `IdentityModule`, this is NOT `@Global()` — nothing analogous to
 * `McpModule.forRoot()`'s internal DI needing cross-module access to this
 * module's providers exists here.
 *
 * `CqrsModule` is imported so `TenantGuard` can inject `CommandBus` to
 * dispatch `UpsertTenantFromClaimCommand` (same convention as
 * `src/contexts/tenant/tenant.module.ts`).
 */
@Module({
  imports: [CqrsModule],
  providers: [
    ...APPLICATION_SERVICES,
    ...INFRASTRUCTURE_GUARDS,
    ...INFRASTRUCTURE_INTERCEPTORS,
  ],
  exports: [
    ...APPLICATION_SERVICES,
    ...INFRASTRUCTURE_GUARDS,
    ...INFRASTRUCTURE_INTERCEPTORS,
  ],
})
export class TenancyModule {}
