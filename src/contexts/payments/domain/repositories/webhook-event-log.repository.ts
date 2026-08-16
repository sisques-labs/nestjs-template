export const WEBHOOK_EVENT_LOG_REPOSITORY = Symbol(
  'WEBHOOK_EVENT_LOG_REPOSITORY',
);

/**
 * Idempotency guard for inbound provider webhooks — pure bookkeeping (no
 * business behavior of its own), so it is not modeled as an aggregate.
 * Relies on a unique `(provider, providerEventId)` DB constraint for
 * race-safety under concurrent redeliveries.
 */
export interface IWebhookEventLogRepository {
  hasProcessed(provider: string, providerEventId: string): Promise<boolean>;
  markProcessed(provider: string, providerEventId: string): Promise<void>;
}
