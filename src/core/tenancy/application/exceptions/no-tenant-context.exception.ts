/**
 * Thrown by `TenantContextService.require()` when `get()` has no tenant id
 * — i.e. it was called from outside a request scoped by `TenantGuard` +
 * `TenantContextInterceptor` (or another caller that established one via
 * `TenantContextService.run()`), such as a background job or a
 * misconfigured route.
 *
 * Deliberately a plain `Error` subclass, not `@sisques-labs/nestjs-kit`'s
 * `BaseException` — that base is for domain exceptions in bounded contexts
 * that get resolved to an HTTP status by `base-exception.filter.ts`. This is
 * a `core/` infrastructure misuse-detection error representing a
 * programming/wiring bug, not something a client request could trigger or
 * that's meant to reach an HTTP response.
 */
export class NoTenantContextException extends Error {
  constructor(
    message: string = 'TenantContextService: no tenant context present. ' +
      'This method must only be called from within a request scoped by ' +
      'TenantGuard + TenantContextInterceptor (or another caller that ' +
      'has established one via TenantContextService.run()) — refusing ' +
      'to build an unscoped query that could leak every tenant’s rows.',
  ) {
    super(message);
    this.name = 'NoTenantContextException';
  }
}
