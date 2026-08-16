# Proposal: Payments Context (`payments`)

## Intent

Services cloned from this template need to charge customers and manage
recurring billing without hard-wiring themselves to one payment vendor. Today
the template ships zero bounded contexts, so there is no established pattern
for "a business capability that talks to a swappable third-party provider."

This change introduces the **first bounded context in the template**:
`payments`. It owns two aggregates — `Payment` (one-off charges, with
refunds) and `Subscription` (recurring billing) — behind a
provider-agnostic hexagonal port. Only a **Stripe** adapter is implemented in
this iteration; the port is designed so a second provider (PayPal, Mercado
Pago, ...) is a pure addition (new adapter + one `useFactory` branch), never a
change to domain/application/transport.

Because this is the precedent-setting context, this proposal is intentionally
explicit about layering, naming, and the DI-time provider-selection pattern —
every future context copies this one.

## Scope

### In Scope
- New `payments` bounded context (domain → application → infrastructure →
  transport), registered in `src/contexts/contexts.module.ts`.
- `PaymentAggregate`: one-off payment intent/charge, with a `refund()` domain
  operation (full or partial) — not a separate aggregate.
- `SubscriptionAggregate`: recurring billing subscription lifecycle
  (create, cancel, status sync from provider events).
- Hexagonal **provider port**: `application/ports/payment-provider.port.ts`
  (`IPaymentProviderPort`), implemented by
  `infrastructure/adapters/stripe-payment-provider.adapter.ts`. Selected at DI
  time via a `useFactory` provider driven by a `PAYMENTS_PROVIDER` env var
  (mirrors the existing `files` context's `FILES_STORAGE_DRIVER` pattern in
  `gardenia-api`, the sibling repo this template's conventions come from).
- Commands: `CreatePayment`, `RefundPayment`, `CreateSubscription`,
  `CancelSubscription`. All money-moving commands require a caller-supplied
  `idempotencyKey`.
- Inbound webhook handling: `ProcessPaymentProviderWebhookEvent` — signature
  verified via the port, deduplicated via a processed-event-id log, updates
  `Payment`/`Subscription` status from normalized provider events
  (`payment_intent.succeeded`, `payment_intent.payment_failed`,
  `charge.refunded`, `invoice.paid`, `customer.subscription.updated`,
  `customer.subscription.deleted`).
- Queries: `PaymentFindById`, `PaymentFindByCriteria`, `SubscriptionFindById`,
  `SubscriptionFindByCriteria` — full type-safe Criteria pattern.
- Events: `PaymentCreated`, `PaymentSucceeded`, `PaymentFailed`,
  `PaymentRefunded`, `SubscriptionCreated`, `SubscriptionStatusChanged`,
  `SubscriptionCanceled`.
- Dual transport: REST (`/payments`, `/subscriptions`,
  `/payments/webhooks/stripe`) + GraphQL for the CRUD-shaped operations
  (webhook ingestion is REST-only — see Approach).
- MCP tools for the four **read-only queries only**. The four money-moving
  commands are explicitly **NOT** exposed as MCP tools in this change (see
  Approach).
- TypeORM entities + one migration: `payments`, `subscriptions`,
  `payment_webhook_events` (idempotency log for inbound webhooks).
- `payments.config.ts` (`registerAs('payments', ...)`): `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `PAYMENTS_PROVIDER` (default `stripe`).
- `stripe` added as a runtime dependency.

### Out of Scope
- A second provider adapter (PayPal, etc.) — the port is designed for it, but
  only Stripe ships now, per explicit product decision.
- Any coupling to a "customers"/"users" context — the template has none yet.
  `customerId` is an opaque caller-supplied string; if/when a consuming
  service adds its own identity context, that context becomes the caller of
  `payments`' public commands/queries (payments never imports another
  context — see Approach).
- Authentication/authorization on the new endpoints — the template has no
  auth infrastructure at all yet (no guards, no `JwtAuthGuard` equivalent).
  Shipping these endpoints unguarded is a real risk, called out explicitly in
  Risks; it is not silently accepted.
- Adjustment/dispute/chargeback handling, multi-currency conversion, tax
  calculation, invoicing/PDF receipts, proration on plan changes.
- A per-event audit ledger beyond the idempotency log (no full webhook-event
  history table with payloads retained).
- Metered/usage-based billing — `Subscription` here is flat recurring only.

## Capabilities

### New Capabilities
- `payments`: Provider-agnostic one-off payments (with refunds) and
  recurring subscriptions, Stripe adapter, signature-verified idempotent
  webhook ingestion, REST + GraphQL + read-only MCP tools.

### Modified Capabilities
- None — this is the first context; nothing pre-existing changes behavior.

## Approach

- **Bounded context, not `core`**: `payments` has its own aggregates,
  business rules (refund clamping, idempotency, status transitions) and
  domain events — the defining trait of a bounded context per the
  architecture skill. `core/` stays reserved for infrastructure with no
  business logic.
- **Hexagonal multi-provider port**: domain/application/transport depend only
  on `IPaymentProviderPort`. `StripePaymentProviderAdapter` is the only
  implementation today; adding `PaypalPaymentProviderAdapter` later is a new
  file + one branch in the `useFactory` provider — zero changes elsewhere.
  This is the same shape as `files`' `IFileStoragePort` (`S3` vs `Database`
  adapters) already proven in the sibling repo.
- **Refund is a domain operation, not a new aggregate**: `PaymentAggregate.
  refund(amount?)` mirrors the `AdjustInventoryItemQuantity` precedent
  (an operation on an existing aggregate, not aggregate-per-verb).
- **Idempotency is mandatory, not optional**: `CreatePayment` and
  `CreateSubscription` require a caller `idempotencyKey`; a unique DB index
  on `(provider, idempotency_key)` makes retried commands return the
  original record instead of double-charging. Stripe's own idempotency-key
  header is also set from the same value on the adapter call, so a network
  retry is safe end-to-end.
- **Webhook idempotency**: a minimal `payment_webhook_events` log
  (`provider`, `provider_event_id` unique, `processed_at`) — infra-level
  bookkeeping, not a domain aggregate (no business behavior of its own).
  Stripe redelivers events; a duplicate `provider_event_id` is a no-op.
- **Webhook transport is REST-only**: provider webhooks are inherently
  server-to-server HTTP POSTs with a vendor-specific raw-body signature
  scheme — there is no GraphQL equivalent, and forcing one would add nothing.
  `POST /payments/webhooks/stripe` reads `req.rawBody` (enabled via `{
  rawBody: true }` on `NestFactory.create` in `main.ts`) to verify the Stripe
  signature without disabling the global JSON body parser for every other
  route.
- **MCP exposure is deliberately partial**: only the four read queries become
  MCP tools. `CreatePayment`, `RefundPayment`, `CreateSubscription`,
  `CancelSubscription` are withheld from MCP in this change — letting an AI
  agent trigger real charges/refunds needs an explicit, separate product
  decision, the same bar the repo's own rules already set for the
  credential-sensitive `auth` context.
- **No cross-context coupling, by construction**: the template has no other
  context to couple to. `payments` imports nothing outside
  `@contexts/payments/`. `customerId` stays an opaque string; a future
  consuming context reaches `payments` the same way any two contexts talk in
  this architecture — via a port on *its own* side, never the reverse.
- **No auth guard in this change**: called out plainly rather than
  papered over. See Risks.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `src/contexts/payments/` | New | Full bounded context |
| `src/contexts/contexts.module.ts` | Modified | Register `PaymentsModule` in `CONTEXT_MODULES` |
| `src/main.ts` | Modified | `{ rawBody: true }` on `NestFactory.create` for Stripe signature verification |
| `src/database/migrations/<timestamp>-CreatePayments.ts` | New | `payments`, `subscriptions`, `payment_webhook_events` tables |
| `package.json` | Modified | Add `stripe` dependency |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Endpoints ship with no auth guard (template has none) | High | Documented loudly here and in the context README; consuming services MUST add their own guard before exposing these routes publicly. Not silently accepted. |
| Duplicate charge on client retry | Med | Mandatory `idempotencyKey` + unique DB index + Stripe idempotency header |
| Webhook redelivery double-processes an event | Med | `payment_webhook_events` unique `provider_event_id` dedup, checked before any state mutation |
| Forged webhook request | Med | Signature verified via `IPaymentProviderPort.verifyWebhookSignature` before any parsing; invalid signature → 400, no processing |
| Money stored as float causes rounding drift | Low | `amount` stored as integer minor units (cents), never float |
| Port leaks Stripe-specific types into domain/application | Med | Port input/result types are provider-neutral DTOs, defined once in `application/ports/`; Stripe SDK types stay inside the adapter file only |
| First-context precedent gets copied with a mistake baked in | Med | This proposal is unusually explicit about layering/naming precisely because every later context will mirror it |

## Rollback Plan

Revert the branch; run migration `down()` (drops `payments`, `subscriptions`,
`payment_webhook_events`). No other table is touched — fully additive and
isolated. No data migration risk since this is a new capability with no
existing rows.

## Dependencies

- New runtime dependency: `stripe` (official Node SDK).
- Reuses `BaseAggregate` / `BaseBuilder` / `UuidValueObject` /
  `StringValueObject` / `NumberValueObject` / `EnumValueObject` /
  `BaseException` / `IBaseReadRepository` / `IBaseWriteRepository` from
  `@sisques-labs/nestjs-kit` (already a dependency).
- Two new env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (required
  when `PAYMENTS_PROVIDER=stripe`, the default).

## Success Criteria

- [ ] `CreatePayment` / `CreateSubscription` / `RefundPayment` /
      `CancelSubscription` work end-to-end against the Stripe adapter.
- [ ] Domain/application/transport contain zero references to the `stripe`
      package — only `infrastructure/adapters/stripe-payment-provider.adapter.ts`
      imports it (enforced by a static import-scan test).
- [ ] Retrying `CreatePayment`/`CreateSubscription` with the same
      `idempotencyKey` returns the original record, never a duplicate.
- [ ] Stripe webhook signature is verified before any event is processed;
      an invalid signature returns 400 and mutates nothing.
- [ ] Redelivering the same webhook event id is a no-op the second time.
- [ ] `PaymentFindByCriteria` / `SubscriptionFindByCriteria` support the
      documented filters via the mandatory Criteria pattern.
- [ ] Only the four read queries are registered as MCP tools; the four
      commands are not.
- [ ] Unit, integration, and E2E tests green; `payments` README documents
      the context per the repo's apply rule.
