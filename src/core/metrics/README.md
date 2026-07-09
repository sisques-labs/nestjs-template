# Metrics (`src/core/metrics`)

Prometheus instrumentation for this service. Cross-cutting operational infra (no
domain model) — lives in `core/`, beside `observability/` (Sentry) and `health/`.

## Endpoint

`GET /api/metrics` → `200`, `Content-Type: text/plain; version=0.0.4`.

Unauthenticated by default — access is expected to be restricted at the network
layer (k8s NetworkPolicy / firewall). Add an auth guard on `MetricsController`
once the service has one.

## Exposed metrics

| Metric | Type | Labels | Source |
|--------|------|--------|--------|
| `process_*`, `nodejs_*` | various | — | `prom-client` default collectors |
| `http_request_duration_seconds` | histogram | `method`, `route`, `status_code`, `transport` | `HttpMetricsInterceptor` |
| `http_requests_total` | counter | `method`, `route`, `status_code`, `transport` | `HttpMetricsInterceptor` |
| `cqrs_handler_duration_seconds` | histogram | `type`, `kind`, `status` | `CqrsMetricsService` |
| `cqrs_handler_total` | counter | `type`, `kind`, `status` | `CqrsMetricsService` |
| `cqrs_events_published_total` | counter | `event` | `CqrsMetricsService` |

`transport` is `http` | `graphql`; `kind` is `command` | `query`; `status` is
`success` | `error`. A `defaultLabels.app=nestjs-template` is applied to every series.

### Label cardinality

Labels are deliberately bounded. HTTP `route` uses the **matched route template**
(`/api/plants/:id`) for REST and the **resolver field name** for GraphQL — never raw
URLs, path/param values, query strings, or tenant ids. CQRS `type`/`event` use class
names. Do not add high-cardinality labels (ids, emails, free text).

## Structure (DDD layers)

```
src/core/metrics/
├── metrics.module.ts
├── domain/
│   ├── constants/metrics.constants.ts     — metric names, label sets, buckets
│   └── types/                             — CqrsKind, CqrsStatus, Transport (one per file)
├── application/
│   └── services/cqrs-metrics.service.ts   — instruments the shared CQRS buses + events
├── infrastructure/
│   └── providers/metric.providers.ts      — prom-client histogram/counter providers
└── transport/
    ├── interceptors/http-metrics.interceptor.ts  — REST + GraphQL duration/count
    └── rest/controllers/metrics.controller.ts    — public GET /api/metrics
```

## How it works

- **HTTP** — a single global `APP_INTERCEPTOR` (`HttpMetricsInterceptor`) observes
  both REST and GraphQL executions, branching on `context.getType()`.
- **CQRS** — `@nestjs/cqrs@10` has no command/query middleware and registers handlers
  onto the single global `CommandBus`/`QueryBus` singletons. A DI override would
  create a second, handler-less instance, so `CqrsMetricsService` wraps the shared
  instances' `execute` at `onModuleInit` and subscribes to the `EventBus` stream for
  publish counts. **No handler is edited.**

## Adding a new metric

1. Add the name + labels to `metrics.constants.ts`.
2. Register a provider in `metrics.module.ts` via `makeCounterProvider` /
   `makeHistogramProvider` / `makeGaugeProvider` (they register on the shared
   `prom-client` registry that the endpoint exposes).
3. Inject it with `@InjectMetric(NAME)` where you record it.
