/**
 * Metric names, label sets, and histogram buckets — the shared vocabulary of the
 * metrics module. Referenced by the infrastructure providers, the transport
 * interceptor, and the application service so names and labels never drift.
 */

export const HTTP_REQUEST_DURATION = 'http_request_duration_seconds';
export const HTTP_REQUESTS_TOTAL = 'http_requests_total';
export const CQRS_HANDLER_DURATION = 'cqrs_handler_duration_seconds';
export const CQRS_HANDLER_TOTAL = 'cqrs_handler_total';
export const CQRS_EVENTS_PUBLISHED_TOTAL = 'cqrs_events_published_total';

export const HTTP_LABELS = [
  'method',
  'route',
  'status_code',
  'transport',
] as const;

// kind: command | query
export const CQRS_LABELS = ['type', 'kind', 'status'] as const;

export const EVENT_LABELS = ['event'] as const;

// Seconds. Tuned for sub-second API calls with headroom for occasional slow paths.
export const DURATION_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];
