# Payments

The first bounded context in this template. Provider-agnostic one-off
payments (with refunds) and recurring subscriptions, behind a hexagonal
port. Only a **Stripe** adapter ships today; adding a second provider is a
new adapter file + one branch in `payment-provider.provider.ts` — no change
to domain, application, or transport.

Full design rationale lives in `openspec/changes/payments-context/` (the
proposal, design doc, and spec that this context was built from).

## ⚠️ Known limitation: no authentication guard

This template has no auth infrastructure at all yet (no `JwtAuthGuard`
equivalent, no session/identity concept). Every REST and GraphQL endpoint in
this context is therefore **unguarded**. This is called out explicitly, not
silently accepted:

> **A consuming service MUST add its own authentication/authorization guard
> before exposing any `/payments` or `/subscriptions` endpoint publicly.**

The webhook endpoint (`POST /payments/webhooks/stripe`) is the one
exception where this doesn't apply — its trust boundary is Stripe's request
signature, verified inside `ProcessPaymentProviderWebhookEventCommand`, not
a session.

## Aggregates

### `PaymentAggregate`
A one-off payment intent/charge. Fields: `id`, `provider`,
`providerPaymentId?`, `customerId` (opaque string — no FK, see below),
`amount` (integer minor units, e.g. cents), `currency`, `status`
(`PENDING | SUCCEEDED | FAILED | REFUNDED | PARTIALLY_REFUNDED`),
`idempotencyKey`, `refundedAmount`, `description?`, `metadata?`.

Refunds are a **state transition on this aggregate**
(`refund(amount?)`), not a separate entity — mirrors how the sibling
`gardenia-api` repo models `AdjustInventoryItemQuantity` as an operation on
an existing aggregate rather than inventing a new one. `refund()` rejects
any amount that would push `refundedAmount` past `amount`, before any
provider call is made.

### `SubscriptionAggregate`
A recurring subscription. Fields: `id`, `provider`,
`providerSubscriptionId?`, `providerCustomerId?`, `customerId`, `priceId`,
`status` (`TRIALING | ACTIVE | PAST_DUE | CANCELED | INCOMPLETE | UNPAID`),
`currentPeriodStart?`, `currentPeriodEnd?`, `cancelAtPeriodEnd`,
`idempotencyKey`, `metadata?`.

Status is driven **exclusively** by `syncStatus()`, called from the webhook
handler — the aggregate never self-assigns a status the provider hasn't
confirmed. `cancel(cancelAtPeriodEnd)` only records intent; the actual
`CANCELED` status arrives later via a `customer.subscription.deleted`
webhook.

## The provider port

`application/ports/payment-provider.port.ts` defines `IPaymentProviderPort`:
`createPaymentIntent`, `refundPayment`, `createSubscription`,
`cancelSubscription`, `verifyWebhookSignature`, plus a `providerName`
property so application handlers can stamp the aggregate's `provider` field
without hardcoding `STRIPE` anywhere.

`infrastructure/adapters/stripe-payment-provider.adapter.ts` is the **only**
file in this context allowed to import the `stripe` package — enforced by
`payments-provider-sdk-isolation.spec.ts`. `infrastructure/config/
payment-provider.provider.ts` selects it at DI time via `PAYMENTS_PROVIDER`
(default `stripe`); an unsupported value fails fast at bootstrap.

## Idempotency

`CreatePayment` and `CreateSubscription` both require a caller-supplied
`idempotencyKey`. A unique `(provider, idempotency_key)` database index
means a retried command with the same key returns the **original** record
without calling the provider again — the handler checks
`findByIdempotencyKey` first. The same key is also forwarded as Stripe's
own idempotency header, so a network-level retry is safe end-to-end.

## Webhook ingestion

`POST /payments/webhooks/stripe` reads `req.rawBody` (enabled via
`{ rawBody: true }` in `main.ts`) and dispatches
`ProcessPaymentProviderWebhookEventCommand`. The handler:

1. Verifies the signature via the port — throws `InvalidWebhookSignatureException`
   (400) before touching any repository if it doesn't check out.
2. Checks a `payment_webhook_events` dedup log by `(provider, providerEventId)`
   — a redelivered event is a no-op.
3. Routes the normalized event type to the matching aggregate method
   (`markSucceeded`, `markFailed`, `refund`, `syncStatus`) and persists.
4. Records the event id as processed.

## Commands

| Command | Effect |
|---|---|
| `CreatePayment` | Calls the provider, persists a `PENDING` payment. Idempotent on `idempotencyKey`. |
| `RefundPayment` | Full or partial refund; rejects over-refund before calling the provider. |
| `CreateSubscription` | Calls the provider, persists the subscription. Idempotent on `idempotencyKey`. |
| `CancelSubscription` | Calls the provider, records `cancelAtPeriodEnd`. |
| `ProcessPaymentProviderWebhookEvent` | Internal — see Webhook ingestion above. |

## Queries

`PaymentFindById`, `PaymentFindByCriteria`, `SubscriptionFindById`,
`SubscriptionFindByCriteria` — the latter two use the standard type-safe
Criteria pattern (queryable-field enum + filterable-fields registry +
filter/sort GraphQL inputs).

## Transport

- **REST**: `POST/GET /payments`, `GET /payments/:id`, `POST /payments/:id/refund`,
  `POST/GET /subscriptions`, `GET /subscriptions/:id`, `POST /subscriptions/:id/cancel`,
  `POST /payments/webhooks/stripe`.
- **GraphQL**: mirrored queries/mutations for everything except the webhook
  (REST-only — webhooks are vendor HTTP POSTs with a raw-body signature
  scheme; there's no GraphQL equivalent).
- **MCP**: only the four read queries are registered as tools
  (`payment_find_by_id`, `payment_find_by_criteria`,
  `subscription_find_by_id`, `subscription_find_by_criteria`). The four
  money-moving commands are **deliberately not exposed** — letting an AI
  agent trigger a real charge or refund needs a separate, explicit product
  decision, the same bar this repo's rules already set for
  credential-sensitive contexts.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `PAYMENTS_PROVIDER` | No (default `stripe`) | Only `stripe` is implemented; any other value fails fast at bootstrap. |
| `STRIPE_SECRET_KEY` | Yes (when provider is `stripe`) | Stripe secret API key. |
| `STRIPE_WEBHOOK_SECRET` | Yes (when provider is `stripe`) | Used to verify `stripe-signature` on inbound webhooks. |

## Explicit scope decisions (not gaps — see the proposal for rationale)

- No second provider adapter yet — the port is ready for one.
- No coupling to any customer/user identity context — none exists in this
  template. `customerId` is an opaque caller-supplied string.
- No chargebacks/disputes, tax calculation, invoicing, proration, or
  metered/usage-based billing.
- No full webhook payload audit history beyond the processed-event-id dedup
  log.
