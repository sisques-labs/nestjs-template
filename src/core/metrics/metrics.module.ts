import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

import { CqrsMetricsService } from './application/services/cqrs-metrics.service';
import { METRIC_PROVIDERS } from './infrastructure/providers/metric.providers';
import { HttpMetricsInterceptor } from './transport/interceptors/http-metrics.interceptor';
import { MetricsController } from './transport/rest/controllers/metrics.controller';

/**
 * Wires Prometheus instrumentation across the DDD layers:
 * - domain: metric names, labels and buckets (the metrics vocabulary).
 * - infrastructure: the prom-client metric providers (`METRIC_PROVIDERS`).
 * - transport: `GET /api/metrics` exposition controller + the global HTTP
 *   (REST + GraphQL) interceptor.
 * - application: `CqrsMetricsService` instruments the shared CQRS bus singletons
 *   and counts published events.
 *
 * Node/process default collectors are enabled by `PrometheusModule.register`.
 */
@Module({
  imports: [
    CqrsModule,
    PrometheusModule.register({
      controller: MetricsController,
      defaultMetrics: { enabled: true },
      defaultLabels: { app: 'nestjs-template' },
    }),
  ],
  providers: [
    ...METRIC_PROVIDERS,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
    CqrsMetricsService,
  ],
})
export class MetricsModule {}
