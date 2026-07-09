import { Provider } from '@nestjs/common';
import {
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';

import {
  CQRS_EVENTS_PUBLISHED_TOTAL,
  CQRS_HANDLER_DURATION,
  CQRS_HANDLER_TOTAL,
  CQRS_LABELS,
  DURATION_BUCKETS,
  EVENT_LABELS,
  HTTP_LABELS,
  HTTP_REQUEST_DURATION,
  HTTP_REQUESTS_TOTAL,
} from '../../domain/constants/metrics.constants';

/**
 * Adapters to `prom-client`: the histogram/counter instances registered on the
 * shared registry that the metrics endpoint serialises. Injected elsewhere via
 * `@InjectMetric(name)`.
 */
export const METRIC_PROVIDERS: Provider[] = [
  makeHistogramProvider({
    name: HTTP_REQUEST_DURATION,
    help: 'HTTP request duration in seconds (REST + GraphQL)',
    labelNames: [...HTTP_LABELS],
    buckets: DURATION_BUCKETS,
  }),
  makeCounterProvider({
    name: HTTP_REQUESTS_TOTAL,
    help: 'Total HTTP requests (REST + GraphQL)',
    labelNames: [...HTTP_LABELS],
  }),
  makeHistogramProvider({
    name: CQRS_HANDLER_DURATION,
    help: 'CQRS command/query handler duration in seconds',
    labelNames: [...CQRS_LABELS],
    buckets: DURATION_BUCKETS,
  }),
  makeCounterProvider({
    name: CQRS_HANDLER_TOTAL,
    help: 'Total CQRS commands/queries executed',
    labelNames: [...CQRS_LABELS],
  }),
  makeCounterProvider({
    name: CQRS_EVENTS_PUBLISHED_TOTAL,
    help: 'Total domain events published on the EventBus',
    labelNames: [...EVENT_LABELS],
  }),
];
