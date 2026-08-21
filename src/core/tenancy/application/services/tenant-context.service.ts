import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

interface TenantContextStore {
  tenantId: string;
}

/**
 * `AsyncLocalStorage`-backed accessor for "the current tenant" during a
 * request. Deliberately a plain singleton, NOT a request-scoped provider —
 * request scope would force every provider transitively depending on this
 * one into request scope too (a known NestJS performance footgun). See
 * `add-tenant-context` design decision 4.
 *
 * Only `run()` is exposed — establishing the tenant id for a callback and
 * everything it calls, including nested async calls. There is
 * deliberately no `enterWith()`-based "set and forget" method: verified
 * empirically against a real Nest HTTP pipeline (not just a mocked
 * `ExecutionContext`) that `enterWith()` called from inside a `Guard`'s
 * `canActivate()` does NOT reliably propagate into the route handler —
 * Nest composes guards/interceptors/handlers through RxJS, which
 * introduces scheduling boundaries `enterWith()` doesn't survive. `run()`
 * wrapping the call synchronously (used by `TenantContextInterceptor`,
 * the only caller) is the reliable mechanism; see that file.
 */
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContextStore>();

  run<T>(tenantId: string, callback: () => T): T {
    return this.storage.run({ tenantId }, callback);
  }

  get(): string | undefined {
    return this.storage.getStore()?.tenantId;
  }
}
