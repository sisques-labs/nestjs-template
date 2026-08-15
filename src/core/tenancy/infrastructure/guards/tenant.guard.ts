import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { UpsertTenantFromClaimCommand } from '@contexts/tenant/application/commands/upsert-tenant-from-claim/upsert-tenant-from-claim.command';
import {
  getPrincipal,
  getRequest,
} from '@core/identity/infrastructure/guards/identity.guard';

import { setTenantId } from '../request-tenant-id.constant';

/**
 * Resolves the current request's tenant from the `IPrincipal.tenantId`
 * `IdentityGuard` attached to the request, upserts the corresponding
 * `Tenant` via `UpsertTenantFromClaimCommand`, and attaches the resolved
 * internal id to the request for `TenantContextInterceptor` to pick up.
 *
 * Must run after `IdentityGuard` in the guard chain
 * (`@UseGuards(IdentityGuard, TenantGuard, ...)`), mirroring `RolesGuard` —
 * reads `request[REQUEST_PRINCIPAL_KEY]` via the same exported
 * `getPrincipal()`/`getRequest()` helpers rather than re-deriving anything
 * from the raw token.
 *
 * Does NOT seed `TenantContextService` itself — a guard's `canActivate()`
 * has no callback wrapping "the rest of the request", and
 * `AsyncLocalStorage.enterWith()` was verified (against a real Nest HTTP
 * pipeline, not just a mocked `ExecutionContext`) to NOT reliably
 * propagate into the route handler through Nest's RxJS-based
 * guard/interceptor/handler composition. `TenantContextInterceptor`
 * (which runs after guards, and CAN wrap the handler in a callback) is
 * the component that actually seeds `TenantContextService`, via
 * `TenantContextService.run()`. Always pair this guard with that
 * interceptor: `@UseGuards(IdentityGuard, TenantGuard)
 * @UseInterceptors(TenantContextInterceptor)`.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly commandBus: CommandBus) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequest(context);
    const principal = getPrincipal(request);
    if (!principal) {
      throw new ForbiddenException('No authenticated principal on request');
    }

    if (principal.tenantId === null) {
      throw new ForbiddenException('Principal carries no tenant claim');
    }

    const tenantId = await this.commandBus.execute<
      UpsertTenantFromClaimCommand,
      string
    >(new UpsertTenantFromClaimCommand({ externalId: principal.tenantId }));

    setTenantId(request, tenantId);

    return true;
  }
}
