import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

import { getRequest } from '@core/identity/infrastructure/guards/identity.guard';

import { TenantContextService } from '../../application/services/tenant-context.service';
import { getTenantId } from '../request-tenant-id.constant';

/**
 * Seeds `TenantContextService` for the rest of the request, from the
 * internal `Tenant` id `TenantGuard` attached to the request.
 *
 * Wraps `next.handle().subscribe(subscriber)` inside
 * `TenantContextService.run()` rather than piping the returned
 * `Observable` — `run()` needs the actual handler invocation (triggered
 * by subscribing) to happen *synchronously inside its callback* for the
 * `AsyncLocalStorage` context to propagate through the handler's own
 * async operations (e.g. a query through a `createTenantScopedRepository()`
 * -wrapped repository). Verified against a real Nest HTTP pipeline,
 * including a nested `await` inside the controller method, before relying
 * on this.
 *
 * Always pair with `TenantGuard`, which runs first and attaches the
 * tenant id this reads: `@UseGuards(IdentityGuard, TenantGuard)
 * @UseInterceptors(TenantContextInterceptor)`. If no tenant id is present
 * (guard misconfigured/omitted), this passes the request through
 * unscoped — `TenantContextService.require()` throws in that case rather
 * than letting a query run unscoped, so the failure surfaces there instead
 * of silently doing nothing here.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContextService: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const tenantId = getTenantId(getRequest(context));

    if (!tenantId) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      this.tenantContextService.run(tenantId, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
