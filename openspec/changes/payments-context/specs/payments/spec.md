# Payments — Provider-agnostic payments and subscriptions

**Source change:** payments-context
**Created:** 2026-08-16

---

## Requirements

### Requirement: PaymentAggregate Fields and Validation

The `PaymentAggregate` MUST carry: `id` (UUID), `provider`
(`PaymentProviderEnum`), `providerPaymentId` (optional string, set once the
provider confirms), `customerId` (opaque string), `amount` (integer minor
units, `> 0`), `currency` (`CurrencyEnum`), `status` (`PaymentStatusEnum`),
`idempotencyKey` (non-empty string), `refundedAmount` (integer, `>= 0`,
default `0`), `description` (optional string), `metadata` (optional
key/value map), `createdAt`, `updatedAt`.

The system MUST reject `amount` that is `<= 0` or non-integer.
The system MUST reject an empty or whitespace-only `idempotencyKey`.

#### Scenario: Valid payment aggregate
- GIVEN provider=STRIPE, customerId="cus_1", amount=1500, currency=USD, a non-empty idempotencyKey
- WHEN a `PaymentAggregate` is built
- THEN all fields are set, status is PENDING, and the aggregate is valid

#### Scenario: Non-positive amount rejected
- GIVEN amount=0
- WHEN a `PaymentAggregate` is built
- THEN a domain validation error is thrown

#### Scenario: Fractional amount rejected
- GIVEN amount=19.99
- WHEN a `PaymentAggregate` is built
- THEN a domain validation error is thrown

---

### Requirement: CreatePayment Command

The command MUST accept `customerId`, `amount`, `currency`, `idempotencyKey`,
and optional `description`, `metadata`.

The handler MUST first check for an existing payment with the same
`(provider, idempotencyKey)`. If one exists, the handler MUST return its
`paymentId` WITHOUT calling the provider port again.

Otherwise the handler MUST call `IPaymentProviderPort.createPaymentIntent`
with the `idempotencyKey` forwarded to the provider, then persist a new
`PaymentAggregate` and emit `PaymentCreated`.

#### Scenario: Happy path
- GIVEN valid input with a fresh idempotencyKey
- WHEN `CreatePayment` is dispatched
- THEN the provider port is called once, a `PaymentAggregate` is persisted with status PENDING, `PaymentCreated` is emitted, and `paymentId` is returned

#### Scenario: Idempotent retry
- GIVEN a payment already exists for `(provider="STRIPE", idempotencyKey="abc")`
- WHEN `CreatePayment` is dispatched again with the same idempotencyKey
- THEN the provider port is NOT called, and the existing `paymentId` is returned

#### Scenario: Provider failure
- GIVEN the provider port throws
- WHEN `CreatePayment` is dispatched
- THEN `PaymentProviderException` (502) is thrown and no `PaymentAggregate` is persisted

#### Scenario: Invalid amount rejected
- GIVEN amount=-5
- WHEN `CreatePayment` is dispatched
- THEN a 400 Bad Request is returned

---

### Requirement: RefundPayment Command

The command MUST accept `paymentId` and optional `amount` (defaults to the
full remaining unrefunded amount) and `reason`.

The handler MUST load the payment via the tenant-agnostic write repository;
if not found, throw `PaymentNotFoundException` (404). The handler MUST
reject a request where `refundedAmount + amount` would exceed the original
`amount`, BEFORE calling the provider port.

On success the handler MUST call `IPaymentProviderPort.refundPayment`, then
call `PaymentAggregate.refund(amount, reason)`, which sets `status` to
`PARTIALLY_REFUNDED` (if some amount remains unrefunded) or `REFUNDED` (if
fully refunded), and emits `PaymentRefunded`.

#### Scenario: Full refund
- GIVEN a payment with amount=1000, refundedAmount=0
- WHEN `RefundPayment` is dispatched with no `amount`
- THEN refundedAmount becomes 1000, status becomes REFUNDED, and `PaymentRefunded` is emitted

#### Scenario: Partial refund
- GIVEN a payment with amount=1000, refundedAmount=0
- WHEN `RefundPayment` is dispatched with amount=300
- THEN refundedAmount becomes 300, status becomes PARTIALLY_REFUNDED

#### Scenario: Over-refund rejected
- GIVEN a payment with amount=1000, refundedAmount=800
- WHEN `RefundPayment` is dispatched with amount=300
- THEN a 400 Bad Request is returned and the provider port is NOT called

#### Scenario: Payment not found
- GIVEN a paymentId that does not exist
- WHEN `RefundPayment` is dispatched
- THEN `PaymentNotFoundException` is thrown and 404 is returned

---

### Requirement: SubscriptionAggregate Fields and Validation

The `SubscriptionAggregate` MUST carry: `id` (UUID), `provider`, `provider
SubscriptionId` (optional), `providerCustomerId` (optional), `customerId`,
`priceId`, `status` (`SubscriptionStatusEnum`), `currentPeriodStart`
(optional Date), `currentPeriodEnd` (optional Date), `cancelAtPeriodEnd`
(boolean, default false), `idempotencyKey`, `createdAt`, `updatedAt`.

#### Scenario: Valid subscription aggregate
- GIVEN provider=STRIPE, customerId="cus_1", priceId="price_pro", a non-empty idempotencyKey
- WHEN a `SubscriptionAggregate` is built
- THEN all fields are set, status is INCOMPLETE, and the aggregate is valid

---

### Requirement: CreateSubscription Command

The command MUST accept `customerId`, `priceId`, `idempotencyKey`, and
optional `metadata`. Idempotent-retry semantics MUST mirror `CreatePayment`
exactly (existing `(provider, idempotencyKey)` match short-circuits the
provider call).

On success the handler MUST call
`IPaymentProviderPort.createSubscription`, persist a new
`SubscriptionAggregate`, and emit `SubscriptionCreated`.

#### Scenario: Happy path
- GIVEN valid input with a fresh idempotencyKey
- WHEN `CreateSubscription` is dispatched
- THEN a `SubscriptionAggregate` is persisted and `SubscriptionCreated` is emitted

#### Scenario: Idempotent retry
- GIVEN a subscription already exists for the same `(provider, idempotencyKey)`
- WHEN `CreateSubscription` is dispatched again
- THEN the provider port is NOT called, and the existing `subscriptionId` is returned

---

### Requirement: CancelSubscription Command

The command MUST accept `subscriptionId` and optional `cancelAtPeriodEnd`
(default `true`).

The handler MUST load the subscription via the write repository; if not
found, throw `SubscriptionNotFoundException` (404). On success it MUST call
`IPaymentProviderPort.cancelSubscription`, then `SubscriptionAggregate.
cancel(cancelAtPeriodEnd)`, which emits `SubscriptionCanceled`.

#### Scenario: Cancel at period end
- GIVEN an ACTIVE subscription
- WHEN `CancelSubscription` is dispatched with cancelAtPeriodEnd=true
- THEN `cancelAtPeriodEnd` becomes true and `SubscriptionCanceled` is emitted; status remains ACTIVE until the provider confirms via webhook

#### Scenario: Subscription not found
- GIVEN a subscriptionId that does not exist
- WHEN `CancelSubscription` is dispatched
- THEN `SubscriptionNotFoundException` is thrown and 404 is returned

---

### Requirement: Inbound Webhook Processing

The system MUST expose `POST /payments/webhooks/stripe`, reading the raw
request body (via `{ rawBody: true }`) and the provider's signature header.

The handler MUST verify the signature via
`IPaymentProviderPort.verifyWebhookSignature` BEFORE any persistence access.
An invalid signature MUST throw `InvalidWebhookSignatureException` and
result in a 400 response with no state change.

The handler MUST check the normalized event's `providerEventId` against the
`payment_webhook_events` log; if already processed, the handler MUST return
200 and make no further state change (it MUST NOT re-process the event).

For a new event, the handler MUST route by normalized `type` to the
matching aggregate operation:
- `payment_succeeded` → `PaymentAggregate.markSucceeded`
- `payment_failed` → `PaymentAggregate.markFailed`
- `charge_refunded` → reconciles `PaymentAggregate.refundedAmount`/`status`
- `invoice_paid` → `SubscriptionAggregate.syncStatus` (period fields updated)
- `subscription_updated` → `SubscriptionAggregate.syncStatus`
- `subscription_deleted` → `SubscriptionAggregate.syncStatus(CANCELED)`

After successful handling, the handler MUST record the event id as
processed.

#### Scenario: Valid event processed
- GIVEN a valid Stripe signature and a `payment_intent.succeeded` payload for a known payment
- WHEN the webhook is received
- THEN the matching `PaymentAggregate` transitions to SUCCEEDED and the event id is recorded as processed

#### Scenario: Invalid signature rejected
- GIVEN a payload with a signature that does not verify against the configured webhook secret
- WHEN the webhook is received
- THEN a 400 Bad Request is returned and no aggregate or webhook-event-log row changes

#### Scenario: Duplicate delivery is a no-op
- GIVEN an event id that was already recorded as processed
- WHEN the same event is redelivered with a valid signature
- THEN 200 is returned and no aggregate is mutated a second time

---

### Requirement: PaymentFindByCriteria / SubscriptionFindByCriteria Queries

Both queries MUST support pagination (`page`, `limit`; default `page=1`,
`limit=20`, max `limit=100`) and filter via the mandatory type-safe Criteria
pattern. `PaymentFindByCriteria` filters: `status`, `customerId`,
`createdAfter`, `createdBefore`. `SubscriptionFindByCriteria` filters:
`status`, `customerId`.

An empty result MUST return 200 with an empty list, not 404.

#### Scenario: Filter by status
- GIVEN payments with status SUCCEEDED and FAILED
- WHEN criteria `status=SUCCEEDED` is applied
- THEN only SUCCEEDED payments are returned

#### Scenario: Empty result returns 200
- GIVEN no payments match the criteria
- WHEN `PaymentFindByCriteria` is dispatched
- THEN 200 is returned with an empty list

---

### Requirement: Provider Isolation

No file outside `infrastructure/adapters/stripe-payment-provider.adapter.ts`
in the `payments` context MUST import the `stripe` package. Domain,
application, and transport layers MUST depend only on
`IPaymentProviderPort` and its DTOs.

#### Scenario: No leaked SDK import
- GIVEN the source tree under `src/contexts/payments/`
- WHEN scanned for imports of the `stripe` package
- THEN the only match is `infrastructure/adapters/stripe-payment-provider.adapter.ts`

---

### Requirement: No Cross-Context Coupling

The `payments` context MUST NOT import from any other `@contexts/` path (none
exist yet in this template, but the rule holds for whichever context is
added next).

#### Scenario: No forbidden imports
- GIVEN the source tree under `src/contexts/payments/`
- WHEN scanned for imports
- THEN no import path matches `@contexts/<other-context>/`

---

### Requirement: REST and GraphQL Transport

The system MUST expose REST endpoints:

| Method | Path | Handler | Success Code |
|--------|------|---------|---------------|
| POST | /payments | CreatePayment | 201 |
| GET | /payments | PaymentFindByCriteria | 200 |
| GET | /payments/:id | PaymentFindById | 200 |
| POST | /payments/:id/refund | RefundPayment | 200 |
| POST | /subscriptions | CreateSubscription | 201 |
| GET | /subscriptions | SubscriptionFindByCriteria | 200 |
| GET | /subscriptions/:id | SubscriptionFindById | 200 |
| POST | /subscriptions/:id/cancel | CancelSubscription | 200 |
| POST | /payments/webhooks/stripe | ProcessPaymentProviderWebhookEvent | 200 / 400 |

The system MUST expose equivalent GraphQL queries and mutations for every
row above EXCEPT the webhook endpoint, which is REST-only.

GraphQL resolvers MUST dispatch exclusively via `CommandBus`/`QueryBus`.

---

### Requirement: MCP Tool Exposure Is Read-Only In This Change

The system MUST register `PaymentFindById`, `PaymentFindByCriteria`,
`SubscriptionFindById`, and `SubscriptionFindByCriteria` as MCP tools.

The system MUST NOT register `CreatePayment`, `RefundPayment`,
`CreateSubscription`, or `CancelSubscription` as MCP tools in this change.
Exposing any money-moving command to MCP requires a separate, explicit
product decision.

#### Scenario: Only queries are AI-callable
- GIVEN the payments MCP tool registry
- WHEN listing registered tools
- THEN exactly `payment_find_by_id`, `payment_list`, `subscription_find_by_id`, `subscription_list` are present, and no command-backed tool is present

---

### Requirement: No Authentication Guard In This Change

The endpoints introduced by this change MUST NOT be silently treated as
production-ready for public exposure: the template has no auth
infrastructure yet, so no guard is applied. This limitation MUST be
documented in `src/contexts/payments/README.md`.

#### Scenario: Documented limitation
- GIVEN the payments context README
- WHEN read
- THEN it explicitly states that no auth guard is applied and that a consuming service must add one before public exposure

---

## Out of Scope

- A second provider adapter (PayPal, etc.) — port is ready, adapter is not built
- Coupling `customerId` to any identity/users context (none exists in the template)
- Any auth guard on the new endpoints
- Chargebacks/disputes, tax calculation, invoicing/PDF receipts, proration, metered billing
- Full webhook payload audit history beyond the processed-event-id dedup log
