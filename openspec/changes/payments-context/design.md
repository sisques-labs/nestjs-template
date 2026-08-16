# Design: Payments Context (`payments`)

## Technical Approach

Standard DDD+CQRS+Hexagonal layering (domain → application → infrastructure →
transport), same shape as every context documented in the architecture skill.
The one structural addition beyond a typical CRUD context is the **provider
port**: `application/ports/payment-provider.port.ts` defines
`IPaymentProviderPort`, a provider-neutral interface. Only
`StripePaymentProviderAdapter` implements it today. Selection happens once,
at DI time, in `payments.module.ts` via a `useFactory` provider keyed off
`PaymentsConfig.provider` (env `PAYMENTS_PROVIDER`, default `'stripe'`) —
identical mechanism to `gardenia-api`'s `files` context, which already picks
between `S3FileStorageAdapter` and `DatabaseFileStorageAdapter` the same way.

`Payment` and `Subscription` are modeled as two aggregates in one context
(not two contexts) because they share the same provider port, the same
`customerId` concept, and the same webhook ingestion pipeline — splitting
them would just duplicate the port and the webhook controller.

Refunds are a domain **operation** on `PaymentAggregate`
(`refund(amount?, reason?)`), not a separate aggregate or command hierarchy —
mirrors the `AdjustInventoryItemQuantity` precedent (`inventory` context):
consumption/restock there, charge/refund here, both are state transitions on
an existing aggregate, not new entities.

Webhook ingestion is a single command, `ProcessPaymentProviderWebhookEvent`,
whose handler:
1. Calls `port.verifyWebhookSignature(rawBody, signature)` — throws
   `InvalidWebhookSignatureException` (400) on failure, before touching any
   state.
2. Checks `payment_webhook_events` for the normalized event's provider event
   id; no-ops if already processed.
3. Switches on the normalized event `type` and delegates to a private method
   per event family (`handlePaymentSucceeded`, `handlePaymentFailed`,
   `handleChargeRefunded`, `handleSubscriptionUpdated`,
   `handleSubscriptionDeleted`, `handleInvoicePaid`) that loads the target
   aggregate via its assert-service and calls the matching domain method.
4. Records the event id as processed.

A single command with an internal switch (rather than one command per Stripe
event type) keeps the CQRS surface proportional to *our* domain operations,
not to the provider's event taxonomy — the provider's event names are a
private detail of the adapter/handler, never exposed as public commands.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|----------|--------|------------------------|-----------|
| Bounded context vs `core` | `src/contexts/payments/` | `src/core/payments/` | `core` has no business logic anywhere in this repo; payments has aggregates, rules, events |
| Multi-provider mechanism | Hexagonal port + DI-time `useFactory` adapter selection | Strategy pattern resolved per-call; separate `StripePaymentsModule`/`PaypalPaymentsModule` | Matches the repo's own established `files` (`IFileStoragePort`) precedent exactly; one seam, one config knob |
| `Payment` + `Subscription` | One context, two aggregates | Two separate contexts (`payments`, `subscriptions`) | Share the port, the customer concept, and the webhook pipeline; splitting duplicates all three |
| Refund modeling | `PaymentAggregate.refund()` operation + `PaymentRefunded` event | Separate `RefundAggregate` | Mirrors `AdjustInventoryItemQuantity`; a refund has no independent lifecycle from its payment |
| Webhook command shape | One `ProcessPaymentProviderWebhookEvent` command, internal switch | One command per provider event type | Public command surface reflects our domain, not the provider's event taxonomy |
| Webhook idempotency | `payment_webhook_events(provider, provider_event_id UNIQUE, processed_at)` infra table, no aggregate | Domain `WebhookEventAggregate` | Pure bookkeeping, zero business behavior — doesn't earn aggregate status |
| Command idempotency | Required `idempotencyKey` + unique `(provider, idempotency_key)` DB index + Stripe idempotency header | Optional idempotency key | A payments context that allows silent double-charging on retry is unsafe by default, not an edge case |
| `amount` storage | Integer minor units (cents), `NumberValueObject` subtype rejecting non-integers and `<= 0` | Decimal/float dollars | Standard practice (matches Stripe's own unit); eliminates float rounding entirely |
| Webhook transport | REST only, raw body via `{ rawBody: true }` in `main.ts` | Also expose via GraphQL | Webhooks are vendor HTTP POSTs with a raw-body signature scheme; no GraphQL equivalent exists |
| MCP exposure | Queries only; commands withheld | Expose all six as MCP tools | Matches the repo's own bar for credential/financial-risk contexts (see `auth` exclusion in the rules); a separate decision is required before an AI agent can trigger a charge or refund |
| Auth guard on endpoints | None in this change; risk documented explicitly | Fabricate a placeholder guard | Template has zero auth infrastructure; a fake guard would be worse than an honest, loud gap |
| `customerId` typing | Opaque `string`, no FK | FK to a `users`/`customers` context | No such context exists in the template; payments must not invent a dependency that doesn't exist |

## Data Flow

```
REST/GraphQL ──────────────────────────────> Command/Query
     │                                              │
CommandBus ──> Handler ──> Builder ──> Aggregate ──> WriteRepo ──> PG
     │              │         (create / refund / cancel)
     │         AssertExists (write repo, 404 on miss)
QueryBus  ──> Handler ──> ReadRepo(criteria) ──> ViewModel ──> Mapper ──> DTO

CreatePayment / CreateSubscription:
  Handler ──> IPaymentProviderPort.createPaymentIntent|createSubscription
              (idempotencyKey passed through) ──> Stripe
         ──> on success: Builder ──> Aggregate.create() ──> WriteRepo

RefundPayment / CancelSubscription:
  Handler ──> AssertExists ──> IPaymentProviderPort.refundPayment|cancelSubscription
         ──> Aggregate.refund()|cancel() ──> WriteRepo

Stripe ──(POST /payments/webhooks/stripe, raw body)──> WebhookController
      ──> ProcessPaymentProviderWebhookEventCommand
      ──> Handler: port.verifyWebhookSignature ──> dedup check (payment_webhook_events)
          ──> switch(event.type) ──> AssertExists ──> Aggregate method ──> WriteRepo
          ──> record event id processed
```

## File Changes

All new under `src/contexts/payments/` (≈70 files, the largest first-context
footprint in the template — reasonable given two aggregates + a provider
port + webhook ingestion). Tree:

```
domain/
  aggregates/payment.aggregate.ts
  aggregates/subscription.aggregate.ts
  builders/payment.builder.ts
  builders/subscription.builder.ts
  enums/payment-provider.enum.ts            — STRIPE
  enums/payment-status.enum.ts               — PENDING | SUCCEEDED | FAILED | REFUNDED | PARTIALLY_REFUNDED
  enums/subscription-status.enum.ts          — TRIALING | ACTIVE | PAST_DUE | CANCELED | INCOMPLETE | UNPAID
  enums/currency.enum.ts                     — USD | EUR | GBP (extend as needed)
  events/payment-created/payment-created.event.ts
  events/payment-succeeded/payment-succeeded.event.ts
  events/payment-failed/payment-failed.event.ts
  events/payment-refunded/payment-refunded.event.ts
  events/subscription-created/subscription-created.event.ts
  events/subscription-status-changed/subscription-status-changed.event.ts
  events/subscription-canceled/subscription-canceled.event.ts
  events/interfaces/payment-event-data.interface.ts
  events/interfaces/subscription-event-data.interface.ts
  exceptions/payment-not-found.exception.ts             # 404
  exceptions/subscription-not-found.exception.ts        # 404
  exceptions/invalid-webhook-signature.exception.ts      # 400
  exceptions/payment-provider.exception.ts               # 502
  interfaces/payment.interface.ts
  interfaces/subscription.interface.ts
  primitives/payment.primitives.ts
  primitives/subscription.primitives.ts
  repositories/read/payment-read.repository.ts
  repositories/read/subscription-read.repository.ts
  repositories/write/payment-write.repository.ts
  repositories/write/subscription-write.repository.ts
  value-objects/payment-id/payment-id.value-object.ts
  value-objects/payment-amount/payment-amount.value-object.ts        — integer, > 0
  value-objects/currency/currency.value-object.ts
  value-objects/payment-provider/payment-provider.value-object.ts
  value-objects/payment-status/payment-status.value-object.ts
  value-objects/idempotency-key/idempotency-key.value-object.ts
  value-objects/subscription-id/subscription-id.value-object.ts
  value-objects/subscription-status/subscription-status.value-object.ts
  view-models/payment.view-model.ts
  view-models/subscription.view-model.ts
application/
  ports/payment-provider.port.ts                          — IPaymentProviderPort + PAYMENT_PROVIDER_PORT
  ports/create-payment-intent-port.input.ts
  ports/payment-intent-port.result.ts
  ports/refund-payment-port.input.ts
  ports/refund-port.result.ts
  ports/create-subscription-port.input.ts
  ports/subscription-port.result.ts
  ports/payment-provider-webhook-event.interface.ts        — normalized event shape
  commands/create-payment/create-payment.command.ts
  commands/create-payment/create-payment.handler.ts
  commands/refund-payment/refund-payment.command.ts
  commands/refund-payment/refund-payment.handler.ts
  commands/create-subscription/create-subscription.command.ts
  commands/create-subscription/create-subscription.handler.ts
  commands/cancel-subscription/cancel-subscription.command.ts
  commands/cancel-subscription/cancel-subscription.handler.ts
  commands/process-payment-provider-webhook-event/process-payment-provider-webhook-event.command.ts
  commands/process-payment-provider-webhook-event/process-payment-provider-webhook-event.handler.ts
  queries/payment-find-by-id/payment-find-by-id.query.ts
  queries/payment-find-by-id/payment-find-by-id.handler.ts
  queries/payment-find-by-criteria/payment-find-by-criteria.query.ts
  queries/payment-find-by-criteria/payment-find-by-criteria.handler.ts
  queries/subscription-find-by-id/subscription-find-by-id.query.ts
  queries/subscription-find-by-id/subscription-find-by-id.handler.ts
  queries/subscription-find-by-criteria/subscription-find-by-criteria.query.ts
  queries/subscription-find-by-criteria/subscription-find-by-criteria.handler.ts
  services/write/assert-payment-exists/assert-payment-exists.service.ts
  services/write/assert-subscription-exists/assert-subscription-exists.service.ts
  services/read/assert-payment-view-model-exists/assert-payment-view-model-exists.service.ts
  services/read/assert-subscription-view-model-exists/assert-subscription-view-model-exists.service.ts
infrastructure/
  adapters/stripe-payment-provider.adapter.ts             — only file importing `stripe`
  persistence/typeorm/entities/payment.entity.ts
  persistence/typeorm/entities/subscription.entity.ts
  persistence/typeorm/entities/payment-webhook-event.entity.ts
  persistence/typeorm/mappers/payment-typeorm.mapper.ts
  persistence/typeorm/mappers/subscription-typeorm.mapper.ts
  persistence/typeorm/repositories/payment-typeorm-write.repository.ts
  persistence/typeorm/repositories/payment-typeorm-read.repository.ts
  persistence/typeorm/repositories/subscription-typeorm-write.repository.ts
  persistence/typeorm/repositories/subscription-typeorm-read.repository.ts
  persistence/webhook-event-log.repository.ts             — idempotency dedup, plain TypeORM repo
  config/payments.config.ts                                — registerAs('payments', ...)
  config/payment-provider.provider.ts                      — useFactory adapter selection
transport/
  rest/controllers/payments.controller.ts
  rest/controllers/subscriptions.controller.ts
  rest/controllers/payments-webhooks.controller.ts          — raw body, no guard, signature-verified
  rest/dtos/create-payment.dto.ts
  rest/dtos/refund-payment.dto.ts
  rest/dtos/create-subscription.dto.ts
  rest/dtos/cancel-subscription.dto.ts
  rest/dtos/payment-rest-response.dto.ts
  rest/dtos/subscription-rest-response.dto.ts
  rest/mappers/payment/payment.mapper.ts
  rest/mappers/subscription/subscription.mapper.ts
  graphql/resolvers/payment-queries.resolver.ts
  graphql/resolvers/payment-mutations.resolver.ts
  graphql/resolvers/subscription-queries.resolver.ts
  graphql/resolvers/subscription-mutations.resolver.ts
  graphql/dtos/requests/create-payment-graphql.dto.ts
  graphql/dtos/requests/refund-payment-graphql.dto.ts
  graphql/dtos/requests/create-subscription-graphql.dto.ts
  graphql/dtos/requests/payment-criteria-graphql.dto.ts
  graphql/dtos/requests/subscription-criteria-graphql.dto.ts
  graphql/dtos/responses/payment.response.dto.ts
  graphql/dtos/responses/subscription.response.dto.ts
  graphql/mappers/payment.mapper.ts
  graphql/mappers/subscription.mapper.ts
  graphql/enums/payments-registered-enums.graphql.ts
  graphql/enums/payment-queryable-field.enum.ts
  graphql/enums/subscription-queryable-field.enum.ts
  graphql/registries/payment-filterable-fields.registry.ts
  graphql/registries/subscription-filterable-fields.registry.ts
  mcp/tools/payment-find-by-id.tool.ts
  mcp/tools/payment-list.tool.ts
  mcp/tools/subscription-find-by-id.tool.ts
  mcp/tools/subscription-list.tool.ts
  mcp/schemas/payment-find-by-id.schema.ts
  mcp/schemas/payment-list.schema.ts
  mcp/schemas/subscription-find-by-id.schema.ts
  mcp/schemas/subscription-list.schema.ts
payments.module.ts
README.md
```

| File | Action | Description |
|------|--------|--------------|
| `src/database/migrations/<timestamp>-CreatePayments.ts` | Create | `payments`, `subscriptions`, `payment_webhook_events` tables + unique indexes |
| `src/contexts/contexts.module.ts` | Modify | Add `PaymentsModule` to `CONTEXT_MODULES` |
| `src/main.ts` | Modify | `NestFactory.create(AppModule, { bufferLogs: true, rawBody: true })` |
| `package.json` | Modify | Add `stripe` dependency |
| `src/contexts/payments/README.md` | Create | Context walkthrough per repo apply rule |

## Interfaces / Contracts

```ts
// application/ports/payment-provider.port.ts
export const PAYMENT_PROVIDER_PORT = Symbol('PAYMENT_PROVIDER_PORT');

export interface IPaymentProviderPort {
  createPaymentIntent(
    input: CreatePaymentIntentPortInput,
  ): Promise<PaymentIntentPortResult>;
  refundPayment(input: RefundPaymentPortInput): Promise<RefundPortResult>;
  createSubscription(
    input: CreateSubscriptionPortInput,
  ): Promise<SubscriptionPortResult>;
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
  verifyWebhookSignature(
    rawBody: Buffer,
    signature: string,
  ): PaymentProviderWebhookEvent;
}

// application/ports/create-payment-intent-port.input.ts
export interface CreatePaymentIntentPortInput {
  amount: number;          // integer minor units
  currency: string;        // ISO 4217
  customerId: string;
  idempotencyKey: string;
  description?: string;
  metadata?: Record<string, string>;
}

// application/ports/payment-provider-webhook-event.interface.ts
export interface PaymentProviderWebhookEvent {
  providerEventId: string;
  type:
    | 'payment_succeeded'
    | 'payment_failed'
    | 'charge_refunded'
    | 'invoice_paid'
    | 'subscription_updated'
    | 'subscription_deleted';
  providerPaymentId?: string;
  providerSubscriptionId?: string;
  raw: unknown; // provider-native payload, for logging only — never leaves the adapter as a typed contract
}
```

**`payments` table columns**: `id` (uuid pk), `provider` (varchar), `provider_payment_id` (varchar NULL), `customer_id` (varchar), `amount` (integer), `currency` (varchar), `status` (varchar), `description` (varchar NULL), `metadata` (jsonb NULL), `idempotency_key` (varchar), `refunded_amount` (integer NOT NULL DEFAULT 0), `created_at`, `updated_at`. Unique index on `(provider, idempotency_key)`. Index on `customer_id`.

**`subscriptions` table columns**: `id` (uuid pk), `provider` (varchar), `provider_subscription_id` (varchar NULL), `provider_customer_id` (varchar NULL), `customer_id` (varchar), `price_id` (varchar), `status` (varchar), `current_period_start` (timestamptz NULL), `current_period_end` (timestamptz NULL), `cancel_at_period_end` (boolean default false), `idempotency_key` (varchar), `created_at`, `updated_at`. Unique index on `(provider, idempotency_key)`. Index on `customer_id`.

**`payment_webhook_events` table columns**: `id` (uuid pk), `provider` (varchar), `provider_event_id` (varchar), `processed_at` (timestamptz). Unique index on `(provider, provider_event_id)`.

**`PaymentAggregate`**: `create()` emits `PaymentCreated`. `markSucceeded(providerPaymentId)` / `markFailed(reason)` emit `PaymentSucceeded`/`PaymentFailed` (invoked from the webhook handler, not directly from a public command). `refund(amount?, reason?)`: defaults to full remaining amount; validates `refundedAmount + amount <= amount` (total); sets `status` to `PARTIALLY_REFUNDED` or `REFUNDED`; emits `PaymentRefunded` with `refundedAmount` and resulting `status`.

**`SubscriptionAggregate`**: `create()` emits `SubscriptionCreated`. `syncStatus(status, currentPeriodStart?, currentPeriodEnd?)` emits `SubscriptionStatusChanged` only when `status` actually differs (invoked from webhook handler). `cancel(cancelAtPeriodEnd)` emits `SubscriptionCanceled`.

**Builders**: receive primitives, construct VOs, pass `IPayment`/`ISubscription` to the aggregate constructor — no static factories, per repo convention.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `PaymentAggregate`: create/refund (full, partial, over-refund rejected) events; `SubscriptionAggregate`: create/syncStatus (no-op when unchanged)/cancel events; all VOs (amount `<= 0` throws, non-integer amount throws, idempotency key empty throws, unknown enum values throw); handlers with a mocked `IPaymentProviderPort` (happy path, provider error → `PaymentProviderException`, duplicate idempotency key → returns existing record without calling the port again); `StripePaymentProviderAdapter` with the Stripe SDK mocked; `ProcessPaymentProviderWebhookEventCommand` handler: invalid signature throws before any repo call, duplicate `provider_event_id` no-ops, each event type routes to the right aggregate method | Jest, `jest.Mocked<T>` |
| Integration | Unique `(provider, idempotency_key)` constraint actually rejects a duplicate insert; `payment_webhook_events` unique constraint dedups; `PaymentFindByCriteria`/`SubscriptionFindByCriteria` filters (status, customerId, date range) via `QueryBuilder`; `amount`/`refunded_amount` integer round-trip | Test DB |
| E2E | REST create/refund/cancel/list flows against a **stubbed** provider adapter (never call real Stripe in CI); webhook endpoint: valid signature processes, invalid signature → 400 and no state change, replayed event id → still 200 but no double-processing; GraphQL mirrors of the same mutations/queries | supertest |
| Static | `payments-provider-sdk-isolation.spec.ts`: scan `src/contexts/payments/**` — assert no import of `stripe` outside `infrastructure/adapters/stripe-payment-provider.adapter.ts`; `payments-no-cross-context-import.spec.ts`: no `@contexts/` import outside `@contexts/payments/` (there are no other contexts yet, but this guards the very first violation) | Jest source scan |

## Migration / Rollout

Single additive migration; `down()` drops all three tables in dependency
order (`payment_webhook_events`, `subscriptions`, `payments`). No backfill,
no impact on any other table (none exist).

## Open Questions

- **Auth guard**: none exists in the template. This change ships the
  endpoints unguarded and documents it as a risk rather than inventing a
  guard the template has no concept of. A consuming service MUST add its own
  guard before these routes are internet-facing. Flagged for explicit
  sign-off, not silently resolved.
- **MCP mutation exposure**: deliberately deferred (see proposal Approach) —
  requires a separate, explicit decision before `CreatePayment` etc. become
  AI-callable.
- **Currency set**: `USD | EUR | GBP` ships as a starting enum; extending it
  is a one-line addition to `currency.enum.ts`, not a structural change.
