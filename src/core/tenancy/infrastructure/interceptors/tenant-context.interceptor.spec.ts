import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, Observable } from 'rxjs';

import { TenantContextService } from '../../application/services/tenant-context.service';
import { setTenantId } from '../request-tenant-id.constant';
import { TenantContextInterceptor } from './tenant-context.interceptor';

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function buildCallHandler(handle: () => Observable<unknown>): CallHandler {
  return { handle };
}

describe('TenantContextInterceptor', () => {
  it('makes the tenant id visible to the handler, including across a nested async step', async () => {
    const tenantContextService = new TenantContextService();
    const interceptor = new TenantContextInterceptor(tenantContextService);
    const request: Record<string, unknown> = { headers: {} };
    setTenantId(request as never, 'tenant-1');

    const next = buildCallHandler(
      () =>
        new Observable((subscriber) => {
          void (async () => {
            await Promise.resolve();
            subscriber.next(tenantContextService.get());
            subscriber.complete();
          })();
        }),
    );

    const result = await firstValueFrom(
      interceptor.intercept(buildContext(request), next),
    );

    expect(result).toBe('tenant-1');
  });

  it('passes the request through unscoped when no tenant id is attached', async () => {
    const tenantContextService = new TenantContextService();
    const interceptor = new TenantContextInterceptor(tenantContextService);
    const request: Record<string, unknown> = { headers: {} };
    const handle = jest.fn(
      () =>
        new Observable((s) => {
          s.next('passthrough');
          s.complete();
        }),
    );
    const next = buildCallHandler(handle);

    const result = await firstValueFrom(
      interceptor.intercept(buildContext(request), next),
    );

    expect(result).toBe('passthrough');
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('isolates concurrent requests from each other', async () => {
    const tenantContextService = new TenantContextService();
    const interceptor = new TenantContextInterceptor(tenantContextService);

    function requestFor(tenantId: string) {
      const request: Record<string, unknown> = { headers: {} };
      setTenantId(request as never, tenantId);
      const next = buildCallHandler(
        () =>
          new Observable((subscriber) => {
            void (async () => {
              await new Promise((resolve) => setTimeout(resolve, 5));
              subscriber.next(tenantContextService.get());
              subscriber.complete();
            })();
          }),
      );
      return firstValueFrom(interceptor.intercept(buildContext(request), next));
    }

    const [a, b] = await Promise.all([
      requestFor('tenant-a'),
      requestFor('tenant-b'),
    ]);

    expect(a).toBe('tenant-a');
    expect(b).toBe('tenant-b');
  });
});
