import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Observable, tap } from 'rxjs';

import {
  HTTP_REQUEST_DURATION,
  HTTP_REQUESTS_TOTAL,
} from '../../domain/constants/metrics.constants';
import { Transport } from '../../domain/types/transport.type';

interface HttpRequestLike {
  method?: string;
  route?: { path?: string };
}

interface HttpResponseLike {
  statusCode?: number;
}

interface GqlInfoLike {
  operation?: { operation?: string };
  fieldName?: string;
}

interface HttpErrorLike {
  status?: number;
}

/**
 * Records HTTP request duration and counts for both REST and GraphQL executions
 * from a single global interceptor.
 *
 * Cardinality is bounded on purpose: REST uses the matched route template
 * (`req.route.path`, e.g. `/api/plants/:id`) — never the raw URL — and GraphQL
 * uses the resolver field name. Path/param values, query strings and tenant ids
 * never become labels.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric(HTTP_REQUEST_DURATION)
    private readonly duration: Histogram<string>,
    @InjectMetric(HTTP_REQUESTS_TOTAL)
    private readonly total: Counter<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const transport = context.getType<Transport>();

    // Only instrument HTTP and GraphQL executions (e.g. skip RPC/MCP).
    if (transport !== 'http' && transport !== 'graphql') {
      return next.handle();
    }

    const start = process.hrtime.bigint();
    const { method, route } = this.resolveTarget(context, transport);

    const record = (statusCode: number): void => {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      const labels = {
        method,
        route,
        status_code: String(statusCode),
        transport,
      };
      this.duration.observe(labels, seconds);
      this.total.inc(labels);
    };

    return next.handle().pipe(
      tap({
        next: () => record(this.successStatus(context, transport)),
        error: (error: HttpErrorLike) => record(error?.status ?? 500),
      }),
    );
  }

  private resolveTarget(
    context: ExecutionContext,
    transport: Transport,
  ): { method: string; route: string } {
    if (transport === 'graphql') {
      const gql = GqlExecutionContext.create(context);
      const info = gql.getInfo<GqlInfoLike>();
      return {
        method: info?.operation?.operation ?? 'query',
        route: info?.fieldName ?? 'unknown',
      };
    }

    const request = context.switchToHttp().getRequest<HttpRequestLike>();
    return {
      method: request.method ?? 'unknown',
      route: request.route?.path ?? 'unknown',
    };
  }

  private successStatus(
    context: ExecutionContext,
    transport: Transport,
  ): number {
    if (transport === 'graphql') {
      return 200;
    }
    const response = context.switchToHttp().getResponse<HttpResponseLike>();
    return response.statusCode ?? 200;
  }
}
