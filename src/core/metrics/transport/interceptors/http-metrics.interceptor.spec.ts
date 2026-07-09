import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { lastValueFrom, of, throwError } from 'rxjs';

import { HttpMetricsInterceptor } from './http-metrics.interceptor';

function buildHttpContext(
  overrides: {
    method?: string;
    routePath?: string;
    url?: string;
    statusCode?: number;
  } = {},
): ExecutionContext {
  const request = {
    method: overrides.method ?? 'GET',
    route: { path: overrides.routePath ?? '/api/orders/:id' },
    url: overrides.url ?? '/api/orders/123',
  };
  const response = { statusCode: overrides.statusCode ?? 200 };

  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

function buildGraphqlContext(
  fieldName = 'orders',
  operation = 'query',
): ExecutionContext {
  const info = { fieldName, operation: { operation } };
  return {
    getType: () => 'graphql',
    getArgs: () => [null, {}, {}, info],
    getClass: () => class {},
    getHandler: () => () => undefined,
  } as unknown as ExecutionContext;
}

function buildCallHandler(value: unknown = 'ok'): CallHandler {
  return { handle: () => of(value) } as CallHandler;
}

describe('HttpMetricsInterceptor', () => {
  let duration: jest.Mocked<Histogram<string>>;
  let total: jest.Mocked<Counter<string>>;
  let interceptor: HttpMetricsInterceptor;

  beforeEach(() => {
    duration = { observe: jest.fn() } as unknown as jest.Mocked<
      Histogram<string>
    >;
    total = { inc: jest.fn() } as unknown as jest.Mocked<Counter<string>>;
    interceptor = new HttpMetricsInterceptor(duration, total);
  });

  describe('REST (http)', () => {
    it('records duration and count with the matched route template', async () => {
      const ctx = buildHttpContext({ statusCode: 201, method: 'POST' });

      await lastValueFrom(interceptor.intercept(ctx, buildCallHandler()));

      const expected = {
        method: 'POST',
        route: '/api/orders/:id',
        status_code: '201',
        transport: 'http',
      };
      expect(total.inc).toHaveBeenCalledWith(expected);
      expect(duration.observe).toHaveBeenCalledWith(
        expected,
        expect.any(Number),
      );
    });

    it('never leaks the raw url or id into the route label', async () => {
      const ctx = buildHttpContext({ url: '/api/orders/123' });

      await lastValueFrom(interceptor.intercept(ctx, buildCallHandler()));

      const labels = total.inc.mock.calls[0][0] as { route: string };
      expect(labels.route).toBe('/api/orders/:id');
      expect(labels.route).not.toContain('123');
    });

    it('records the error status code when the handler throws', async () => {
      const ctx = buildHttpContext();
      const next = {
        handle: () => throwError(() => ({ status: 404 })),
      } as CallHandler;

      await expect(
        lastValueFrom(interceptor.intercept(ctx, next)),
      ).rejects.toBeDefined();

      expect(total.inc).toHaveBeenCalledWith(
        expect.objectContaining({ status_code: '404' }),
      );
    });

    it('defaults the error status code to 500 when none is present', async () => {
      const ctx = buildHttpContext();
      const next = {
        handle: () => throwError(() => new Error('boom')),
      } as CallHandler;

      await expect(
        lastValueFrom(interceptor.intercept(ctx, next)),
      ).rejects.toThrow('boom');

      expect(total.inc).toHaveBeenCalledWith(
        expect.objectContaining({ status_code: '500' }),
      );
    });
  });

  describe('GraphQL', () => {
    it('records with transport=graphql and the resolver field name as route', async () => {
      const ctx = buildGraphqlContext('orders', 'query');

      await lastValueFrom(interceptor.intercept(ctx, buildCallHandler()));

      const expected = {
        method: 'query',
        route: 'orders',
        status_code: '200',
        transport: 'graphql',
      };
      expect(total.inc).toHaveBeenCalledWith(expected);
      expect(duration.observe).toHaveBeenCalledWith(
        expected,
        expect.any(Number),
      );
    });
  });

  describe('non-http/graphql contexts', () => {
    it('passes through without recording', async () => {
      const ctx = { getType: () => 'rpc' } as unknown as ExecutionContext;

      await lastValueFrom(interceptor.intercept(ctx, buildCallHandler('x')));

      expect(total.inc).not.toHaveBeenCalled();
      expect(duration.observe).not.toHaveBeenCalled();
    });
  });
});
