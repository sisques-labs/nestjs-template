import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Request } from 'express';

import { UpsertTenantFromClaimCommand } from '@contexts/tenant/application/commands/upsert-tenant-from-claim/upsert-tenant-from-claim.command';
import {
  getPrincipal,
  getRequest,
} from '@core/identity/infrastructure/guards/identity.guard';

import { setTenantId } from '../request-tenant-id.constant';

/** Request header a caller uses to pick which of their tenants a given
 * request operates against. Express lowercases incoming header names, so
 * this is read off `request.headers` as-is (no case-insensitive lookup
 * needed). */
export const TENANT_ID_HEADER = 'x-tenant-id';

/**
 * Resolves the current request's tenant, upserts the corresponding
 * `Tenant` via `UpsertTenantFromClaimCommand`, and attaches the resolved
 * internal id to the request for `TenantContextInterceptor` to pick up.
 *
 * Must run after `IdentityGuard` in the guard chain
 * (`@UseGuards(IdentityGuard, TenantGuard, ...)`), mirroring `RolesGuard` —
 * reads `request[REQUEST_PRINCIPAL_KEY]` via the same exported
 * `getPrincipal()`/`getRequest()` helpers rather than re-deriving anything
 * from the raw token.
 *
 * ## Tenant selection: `X-Tenant-Id` vs. `IPrincipal.tenantIds`
 *
 * A principal can legitimately belong to more than one tenant —
 * `IPrincipal.tenantIds` is the full list the IdP's verified claims proved
 * membership in. Since a single request still only ever operates against
 * one tenant, the caller selects which one via the `X-Tenant-Id` header.
 *
 * **Security property — this is the load-bearing part of this guard**: the
 * header only ever *selects among* tenants `tenantIds` already proves
 * membership in. It is NEVER trusted blindly, and it can NEVER grant access
 * to a tenant the principal isn't verified for — the header is client
 * input, `tenantIds` is derived from a cryptographically verified token,
 * and only the latter is a source of truth for "which tenants may this
 * request touch". Concretely:
 *
 * - Header present: the value MUST appear in `principal.tenantIds`,
 *   otherwise the request is rejected with `403 Forbidden` — a caller
 *   cannot use the header to reach a tenant they don't belong to.
 * - Header absent, exactly one entry in `tenantIds`: that entry is used
 *   (unambiguous default — same UX as the single-tenant case had before
 *   this header existed).
 * - Header absent, zero entries in `tenantIds`: `403 Forbidden` (no tenant
 *   claim at all).
 * - Header absent, more than one entry in `tenantIds`: `403 Forbidden`
 *   telling the caller to specify the header — this guard never guesses
 *   which of several valid tenants a request meant.
 *
 * Whichever external tenant id is resolved this way is what gets passed to
 * `UpsertTenantFromClaimCommand`, exactly as before this header existed.
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

    const externalTenantId = resolveExternalTenantId(
      request,
      principal.tenantIds,
    );

    const tenantId = await this.commandBus.execute<
      UpsertTenantFromClaimCommand,
      string
    >(new UpsertTenantFromClaimCommand({ externalId: externalTenantId }));

    setTenantId(request, tenantId);

    return true;
  }
}

/**
 * Resolves which external tenant id this request operates against, per the
 * selection rules documented on `TenantGuard` above. Throws
 * `ForbiddenException` for every rejecting branch (header names a tenant
 * not in `tenantIds`; no header and zero or multiple `tenantIds`) rather
 * than returning a nullable value, so callers can't accidentally forget to
 * check it.
 */
function resolveExternalTenantId(
  request: Request,
  tenantIds: string[],
): string {
  const requestedTenantId = readTenantIdHeader(request);

  if (requestedTenantId !== undefined) {
    if (!tenantIds.includes(requestedTenantId)) {
      throw new ForbiddenException(
        'Principal is not a member of the requested tenant',
      );
    }
    return requestedTenantId;
  }

  if (tenantIds.length === 0) {
    throw new ForbiddenException('Principal carries no tenant claim');
  }

  if (tenantIds.length > 1) {
    throw new ForbiddenException(
      `Principal belongs to multiple tenants; specify the ${TENANT_ID_HEADER} header`,
    );
  }

  return tenantIds[0];
}

/**
 * Reads the `X-Tenant-Id` header off the request. Express lowercases
 * header names, so this reads `request.headers['x-tenant-id']` directly.
 *
 * Per Express's types that value is `string | string[] | undefined` — a
 * repeated header (`X-Tenant-Id: a` and `X-Tenant-Id: b` on the same
 * request) is malformed input for a header meant to carry a single id, so
 * an array is treated the same as "header absent": this function returns
 * `undefined` for it. That falls through to the absent-header branches in
 * `resolveExternalTenantId` above, i.e. it does NOT get treated as a
 * (possibly attacker-chosen) selection — a malformed header can only ever
 * make the request stricter (fall back to the unambiguous-single-tenant or
 * ambiguous-403 cases), never bypass the "must be in tenantIds" check.
 */
function readTenantIdHeader(request: Request): string | undefined {
  const value = request.headers[TENANT_ID_HEADER];
  return typeof value === 'string' ? value : undefined;
}
