import { Request } from 'express';

/**
 * Property key `TenantGuard` attaches the resolved internal `Tenant` id
 * under on the request object. Read by `TenantContextInterceptor`, which
 * seeds `TenantContextService` for the rest of the request — see that
 * file for why this is a two-step handoff (guard -> request -> interceptor)
 * instead of the guard populating the context service directly.
 */
export const REQUEST_TENANT_ID_KEY = 'tenantId';

export function setTenantId(request: Request, tenantId: string): void {
  (request as Request & { [REQUEST_TENANT_ID_KEY]?: string })[
    REQUEST_TENANT_ID_KEY
  ] = tenantId;
}

export function getTenantId(request: Request): string | undefined {
  return (request as Request & { [REQUEST_TENANT_ID_KEY]?: string })[
    REQUEST_TENANT_ID_KEY
  ];
}
