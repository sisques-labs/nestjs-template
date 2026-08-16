# Tasks: Payments Context (`payments-context`)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2 400 – 3 000 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → Domain · PR 2 → Application + Port · PR 3 → Infrastructure (Stripe adapter + persistence + migration) · PR 4 → Transport (REST/GraphQL/MCP) · PR 5 → Tests |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Domain layer (no I/O) | PR 1 | Both aggregates, all VOs, events, exceptions, primitives, view-models, repo interfaces |
| 2 | Application layer + port definitions | PR 2 | Port interface + DTOs, commands, queries, assert services — port has no implementation yet, tested with mocks |
| 3 | Infrastructure: Stripe adapter + persistence + migration | PR 3 | The only unit allowed to import the `stripe` package |
| 4 | Transport: REST + GraphQL + MCP + module wiring | PR 4 | Controllers, resolvers, DTOs, MCP tools, `payments.module.ts`, `contexts.module.ts`, `main.ts` |
| 5 | Tests (unit + integration + e2e + static) | PR 5 | All test files, including the two static import-boundary specs |

---

## Phase 1: Domain

### Payment aggregate
- [ ] 1.1 Create `src/contexts/payments/domain/enums/payment-provider.enum.ts` — `PaymentProviderEnum` (`STRIPE`)
- [ ] 1.2 Create `src/contexts/payments/domain/enums/payment-status.enum.ts` — `PaymentStatusEnum` (`PENDING`, `SUCCEEDED`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED`)
- [ ] 1.3 Create `src/contexts/payments/domain/enums/currency.enum.ts` — `CurrencyEnum` (`USD`, `EUR`, `GBP`)
- [ ] 1.4 Create `src/contexts/payments/domain/value-objects/payment-id/payment-id.value-object.ts` — extends `UuidValueObject`
- [ ] 1.5 Create `src/contexts/payments/domain/value-objects/payment-amount/payment-amount.value-object.ts` — extends `NumberValueObject`; integer minor units; rejects `<= 0` and non-integers
- [ ] 1.6 Create `src/contexts/payments/domain/value-objects/currency/currency.value-object.ts` — extends `EnumValueObject<typeof CurrencyEnum>`
- [ ] 1.7 Create `src/contexts/payments/domain/value-objects/payment-provider/payment-provider.value-object.ts` — extends `EnumValueObject<typeof PaymentProviderEnum>`
- [ ] 1.8 Create `src/contexts/payments/domain/value-objects/payment-status/payment-status.value-object.ts` — extends `EnumValueObject<typeof PaymentStatusEnum>`
- [ ] 1.9 Create `src/contexts/payments/domain/value-objects/idempotency-key/idempotency-key.value-object.ts` — extends `StringValueObject`; rejects empty/whitespace
- [ ] 1.10 Create `src/contexts/payments/domain/events/interfaces/payment-event-data.interface.ts`
- [ ] 1.11 Create `src/contexts/payments/domain/events/payment-created/payment-created.event.ts`
- [ ] 1.12 Create `src/contexts/payments/domain/events/payment-succeeded/payment-succeeded.event.ts`
- [ ] 1.13 Create `src/contexts/payments/domain/events/payment-failed/payment-failed.event.ts`
- [ ] 1.14 Create `src/contexts/payments/domain/events/payment-refunded/payment-refunded.event.ts` — carries `refundedAmount`, `reason?`, resulting `status`
- [ ] 1.15 Create `src/contexts/payments/domain/exceptions/payment-not-found.exception.ts` — HTTP 404
- [ ] 1.16 Create `src/contexts/payments/domain/exceptions/payment-provider.exception.ts` — HTTP 502, wraps adapter failures
- [ ] 1.17 Create `src/contexts/payments/domain/interfaces/payment.interface.ts` — `IPayment` with VO-typed fields
- [ ] 1.18 Create `src/contexts/payments/domain/primitives/payment.primitives.ts` — `IPaymentPrimitives extends BasePrimitives`
- [ ] 1.19 Create `src/contexts/payments/domain/view-models/payment.view-model.ts` — `PaymentViewModel extends BaseViewModel`
- [ ] 1.20 Create `src/contexts/payments/domain/repositories/write/payment-write.repository.ts` — `IPaymentWriteRepository` + `PAYMENT_WRITE_REPOSITORY` token; `findByIdempotencyKey(provider, key)` for the idempotent-retry path
- [ ] 1.21 Create `src/contexts/payments/domain/repositories/read/payment-read.repository.ts` — `IPaymentReadRepository` + `PAYMENT_READ_REPOSITORY` token; `PaymentCriteria` type (`status?`, `customerId?`, `createdAfter?`, `createdBefore?`, `page?`, `limit?`)
- [ ] 1.22 Create `src/contexts/payments/domain/aggregates/payment.aggregate.ts` — `create()` emits `PaymentCreated`; `markSucceeded(providerPaymentId)` emits `PaymentSucceeded`; `markFailed(reason)` emits `PaymentFailed`; `refund(amount?, reason?)` — defaults to remaining amount, rejects `refundedAmount + amount > amount`, sets status `REFUNDED`/`PARTIALLY_REFUNDED`, emits `PaymentRefunded`
- [ ] 1.23 Create `src/contexts/payments/domain/builders/payment.builder.ts` — extends `BaseBuilder`; receives `IPaymentPrimitives`, wraps in VOs

### Subscription aggregate
- [ ] 1.24 Create `src/contexts/payments/domain/enums/subscription-status.enum.ts` — `SubscriptionStatusEnum` (`TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED`, `INCOMPLETE`, `UNPAID`)
- [ ] 1.25 Create `src/contexts/payments/domain/value-objects/subscription-id/subscription-id.value-object.ts` — extends `UuidValueObject`
- [ ] 1.26 Create `src/contexts/payments/domain/value-objects/subscription-status/subscription-status.value-object.ts` — extends `EnumValueObject<typeof SubscriptionStatusEnum>`
- [ ] 1.27 Create `src/contexts/payments/domain/events/interfaces/subscription-event-data.interface.ts`
- [ ] 1.28 Create `src/contexts/payments/domain/events/subscription-created/subscription-created.event.ts`
- [ ] 1.29 Create `src/contexts/payments/domain/events/subscription-status-changed/subscription-status-changed.event.ts`
- [ ] 1.30 Create `src/contexts/payments/domain/events/subscription-canceled/subscription-canceled.event.ts`
- [ ] 1.31 Create `src/contexts/payments/domain/exceptions/subscription-not-found.exception.ts` — HTTP 404
- [ ] 1.32 Create `src/contexts/payments/domain/interfaces/subscription.interface.ts` — `ISubscription`
- [ ] 1.33 Create `src/contexts/payments/domain/primitives/subscription.primitives.ts` — `ISubscriptionPrimitives extends BasePrimitives`
- [ ] 1.34 Create `src/contexts/payments/domain/view-models/subscription.view-model.ts` — `SubscriptionViewModel extends BaseViewModel`
- [ ] 1.35 Create `src/contexts/payments/domain/repositories/write/subscription-write.repository.ts` — `ISubscriptionWriteRepository` + `SUBSCRIPTION_WRITE_REPOSITORY` token; `findByIdempotencyKey`
- [ ] 1.36 Create `src/contexts/payments/domain/repositories/read/subscription-read.repository.ts` — `ISubscriptionReadRepository` + `SUBSCRIPTION_READ_REPOSITORY` token; `SubscriptionCriteria` (`status?`, `customerId?`, `page?`, `limit?`)
- [ ] 1.37 Create `src/contexts/payments/domain/aggregates/subscription.aggregate.ts` — `create()` emits `SubscriptionCreated`; `syncStatus(status, currentPeriodStart?, currentPeriodEnd?)` emits `SubscriptionStatusChanged` only when `status` differs; `cancel(cancelAtPeriodEnd)` emits `SubscriptionCanceled`
- [ ] 1.38 Create `src/contexts/payments/domain/builders/subscription.builder.ts` — extends `BaseBuilder`

### Webhook idempotency (infra bookkeeping, declared here for visibility)
- [ ] 1.39 Create `src/contexts/payments/domain/exceptions/invalid-webhook-signature.exception.ts` — HTTP 400

---

## Phase 2: Application

### Port
- [ ] 2.1 Create `src/contexts/payments/application/ports/create-payment-intent-port.input.ts`
- [ ] 2.2 Create `src/contexts/payments/application/ports/payment-intent-port.result.ts`
- [ ] 2.3 Create `src/contexts/payments/application/ports/refund-payment-port.input.ts`
- [ ] 2.4 Create `src/contexts/payments/application/ports/refund-port.result.ts`
- [ ] 2.5 Create `src/contexts/payments/application/ports/create-subscription-port.input.ts`
- [ ] 2.6 Create `src/contexts/payments/application/ports/subscription-port.result.ts`
- [ ] 2.7 Create `src/contexts/payments/application/ports/payment-provider-webhook-event.interface.ts` — normalized event shape, `type` union
- [ ] 2.8 Create `src/contexts/payments/application/ports/payment-provider.port.ts` — `IPaymentProviderPort` + `PAYMENT_PROVIDER_PORT` token

### Assert services
- [ ] 2.9 Create `src/contexts/payments/application/services/write/assert-payment-exists/assert-payment-exists.service.ts`
- [ ] 2.10 Create `src/contexts/payments/application/services/write/assert-subscription-exists/assert-subscription-exists.service.ts`
- [ ] 2.11 Create `src/contexts/payments/application/services/read/assert-payment-view-model-exists/assert-payment-view-model-exists.service.ts`
- [ ] 2.12 Create `src/contexts/payments/application/services/read/assert-subscription-view-model-exists/assert-subscription-view-model-exists.service.ts`

### Commands
- [ ] 2.13 Create `src/contexts/payments/application/commands/create-payment/create-payment.command.ts` — `CreatePaymentCommandInput` (`customerId`, `amount`, `currency`, `idempotencyKey`, `description?`, `metadata?`)
- [ ] 2.14 Create `src/contexts/payments/application/commands/create-payment/create-payment.handler.ts` — checks `findByIdempotencyKey` first (returns existing `paymentId` if present, no port call); else calls `port.createPaymentIntent`, builds + persists `PaymentAggregate`, logs
- [ ] 2.15 Create `src/contexts/payments/application/commands/refund-payment/refund-payment.command.ts` — `paymentId`, `amount?`, `reason?`
- [ ] 2.16 Create `src/contexts/payments/application/commands/refund-payment/refund-payment.handler.ts` — `AssertPaymentExistsService`; calls `port.refundPayment`; `aggregate.refund()`; saves; logs
- [ ] 2.17 Create `src/contexts/payments/application/commands/create-subscription/create-subscription.command.ts` — `customerId`, `priceId`, `idempotencyKey`, `metadata?`
- [ ] 2.18 Create `src/contexts/payments/application/commands/create-subscription/create-subscription.handler.ts` — idempotency-key short-circuit, then `port.createSubscription`, builds + persists
- [ ] 2.19 Create `src/contexts/payments/application/commands/cancel-subscription/cancel-subscription.command.ts` — `subscriptionId`, `cancelAtPeriodEnd?`
- [ ] 2.20 Create `src/contexts/payments/application/commands/cancel-subscription/cancel-subscription.handler.ts` — `AssertSubscriptionExistsService`; `port.cancelSubscription`; `aggregate.cancel()`; saves
- [ ] 2.21 Create `src/contexts/payments/application/commands/process-payment-provider-webhook-event/process-payment-provider-webhook-event.command.ts` — `provider`, `rawBody: Buffer`, `signature`
- [ ] 2.22 Create `src/contexts/payments/application/commands/process-payment-provider-webhook-event/process-payment-provider-webhook-event.handler.ts` — `port.verifyWebhookSignature` (throws `InvalidWebhookSignatureException` on failure, before any repo access); dedup check via webhook-event-log repo; `switch(event.type)` → load target aggregate via assert service → call matching domain method → save; record event id processed; logs start + completion + which branch was taken

### Queries
- [ ] 2.23 Create `src/contexts/payments/application/queries/payment-find-by-id/payment-find-by-id.query.ts`
- [ ] 2.24 Create `src/contexts/payments/application/queries/payment-find-by-id/payment-find-by-id.handler.ts`
- [ ] 2.25 Create `src/contexts/payments/application/queries/payment-find-by-criteria/payment-find-by-criteria.query.ts`
- [ ] 2.26 Create `src/contexts/payments/application/queries/payment-find-by-criteria/payment-find-by-criteria.handler.ts`
- [ ] 2.27 Create `src/contexts/payments/application/queries/subscription-find-by-id/subscription-find-by-id.query.ts`
- [ ] 2.28 Create `src/contexts/payments/application/queries/subscription-find-by-id/subscription-find-by-id.handler.ts`
- [ ] 2.29 Create `src/contexts/payments/application/queries/subscription-find-by-criteria/subscription-find-by-criteria.query.ts`
- [ ] 2.30 Create `src/contexts/payments/application/queries/subscription-find-by-criteria/subscription-find-by-criteria.handler.ts`

---

## Phase 3: Infrastructure

### Stripe adapter (only file allowed to import `stripe`)
- [ ] 3.1 Add `stripe` to `package.json` dependencies
- [ ] 3.2 Create `src/contexts/payments/infrastructure/config/payments.config.ts` — `registerAs('payments', ...)`: `provider` (`PAYMENTS_PROVIDER`, default `stripe`), `stripeSecretKey` (`STRIPE_SECRET_KEY`), `stripeWebhookSecret` (`STRIPE_WEBHOOK_SECRET`)
- [ ] 3.3 Create `src/contexts/payments/infrastructure/adapters/stripe-payment-provider.adapter.ts` — implements `IPaymentProviderPort`; constructs `new Stripe(secretKey)`; `createPaymentIntent` passes `idempotencyKey` as the Stripe request's idempotency key; `verifyWebhookSignature` uses `stripe.webhooks.constructEvent`; maps Stripe event `type` strings to the normalized `PaymentProviderWebhookEvent.type` union; catches Stripe SDK errors and rethrows `PaymentProviderException`
- [ ] 3.4 Create `src/contexts/payments/infrastructure/config/payment-provider.provider.ts` — `useFactory` `Provider` bound to `PAYMENT_PROVIDER_PORT`, branching on `config.provider` (only `'stripe'` branch implemented; default/else throws a clear config error rather than silently picking Stripe)

### Persistence
- [ ] 3.5 Create `src/contexts/payments/infrastructure/persistence/typeorm/entities/payment.entity.ts` — `payments` table; unique index on `(provider, idempotency_key)`; index on `customer_id`
- [ ] 3.6 Create `src/contexts/payments/infrastructure/persistence/typeorm/entities/subscription.entity.ts` — `subscriptions` table; same index shape
- [ ] 3.7 Create `src/contexts/payments/infrastructure/persistence/typeorm/entities/payment-webhook-event.entity.ts` — `payment_webhook_events`; unique index on `(provider, provider_event_id)`
- [ ] 3.8 Create `src/contexts/payments/infrastructure/persistence/typeorm/mappers/payment-typeorm.mapper.ts`
- [ ] 3.9 Create `src/contexts/payments/infrastructure/persistence/typeorm/mappers/subscription-typeorm.mapper.ts`
- [ ] 3.10 Create `src/contexts/payments/infrastructure/persistence/typeorm/repositories/payment-typeorm-write.repository.ts` — implements `IPaymentWriteRepository`, incl. `findByIdempotencyKey`
- [ ] 3.11 Create `src/contexts/payments/infrastructure/persistence/typeorm/repositories/payment-typeorm-read.repository.ts` — `findByCriteria` via `QueryBuilder` covering `status`, `customerId`, `createdAfter`/`createdBefore`
- [ ] 3.12 Create `src/contexts/payments/infrastructure/persistence/typeorm/repositories/subscription-typeorm-write.repository.ts`
- [ ] 3.13 Create `src/contexts/payments/infrastructure/persistence/typeorm/repositories/subscription-typeorm-read.repository.ts`
- [ ] 3.14 Create `src/contexts/payments/infrastructure/persistence/webhook-event-log.repository.ts` — plain repo: `hasProcessed(provider, providerEventId)`, `markProcessed(provider, providerEventId)`; relies on the unique index for race-safety
- [ ] 3.15 Create `src/database/migrations/<timestamp>-CreatePayments.ts` — `up()` creates all three tables + indexes; `down()` drops in dependency order

---

## Phase 4: Transport

### REST
- [ ] 4.1 Create `src/contexts/payments/transport/rest/dtos/create-payment.dto.ts` — `customerId`, `amount` (int, `> 0`), `currency` (enum), `idempotencyKey`, optional `description`, `metadata`
- [ ] 4.2 Create `src/contexts/payments/transport/rest/dtos/refund-payment.dto.ts` — optional `amount`, optional `reason`
- [ ] 4.3 Create `src/contexts/payments/transport/rest/dtos/create-subscription.dto.ts` — `customerId`, `priceId`, `idempotencyKey`, optional `metadata`
- [ ] 4.4 Create `src/contexts/payments/transport/rest/dtos/cancel-subscription.dto.ts` — optional `cancelAtPeriodEnd`
- [ ] 4.5 Create `src/contexts/payments/transport/rest/dtos/payment-rest-response.dto.ts`
- [ ] 4.6 Create `src/contexts/payments/transport/rest/dtos/subscription-rest-response.dto.ts`
- [ ] 4.7 Create `src/contexts/payments/transport/rest/mappers/payment/payment.mapper.ts`
- [ ] 4.8 Create `src/contexts/payments/transport/rest/mappers/subscription/subscription.mapper.ts`
- [ ] 4.9 Create `src/contexts/payments/transport/rest/controllers/payments.controller.ts` — `POST /payments` (201), `GET /payments` (200), `GET /payments/:id` (200), `POST /payments/:id/refund` (200); log at each entry point; **no guard applied — see README limitation note**
- [ ] 4.10 Create `src/contexts/payments/transport/rest/controllers/subscriptions.controller.ts` — `POST /subscriptions` (201), `GET /subscriptions` (200), `GET /subscriptions/:id` (200), `POST /subscriptions/:id/cancel` (200)
- [ ] 4.11 Create `src/contexts/payments/transport/rest/controllers/payments-webhooks.controller.ts` — `POST /payments/webhooks/stripe`; `@Req() req: RawBodyRequest<Request>`; reads `req.rawBody` + `stripe-signature` header; dispatches `ProcessPaymentProviderWebhookEventCommand`; returns 400 on `InvalidWebhookSignatureException`, 200 otherwise (incl. dedup no-ops)
- [ ] 4.12 Modify `src/main.ts` — `NestFactory.create(AppModule, { bufferLogs: true, rawBody: true })`

### GraphQL
- [ ] 4.13 Create `src/contexts/payments/transport/graphql/enums/payments-registered-enums.graphql.ts` — `registerEnumType` for `PaymentStatusEnum`, `SubscriptionStatusEnum`, `CurrencyEnum`
- [ ] 4.14 Create `src/contexts/payments/transport/graphql/enums/payment-queryable-field.enum.ts` — `PaymentQueryableField` (`status`, `customerId`, `createdAt`)
- [ ] 4.15 Create `src/contexts/payments/transport/graphql/enums/subscription-queryable-field.enum.ts` — `SubscriptionQueryableField` (`status`, `customerId`)
- [ ] 4.16 Create `src/contexts/payments/transport/graphql/registries/payment-filterable-fields.registry.ts` — `paymentFilterableFields: FilterFieldRegistry<PaymentQueryableField>`; `status` as `{ type: 'enum', enum: PaymentStatusEnum }`; co-located `.spec.ts`
- [ ] 4.17 Create `src/contexts/payments/transport/graphql/registries/subscription-filterable-fields.registry.ts` — same shape; co-located `.spec.ts`
- [ ] 4.18 Create `src/contexts/payments/transport/graphql/dtos/requests/create-payment-graphql.dto.ts`
- [ ] 4.19 Create `src/contexts/payments/transport/graphql/dtos/requests/refund-payment-graphql.dto.ts`
- [ ] 4.20 Create `src/contexts/payments/transport/graphql/dtos/requests/create-subscription-graphql.dto.ts`
- [ ] 4.21 Create `src/contexts/payments/transport/graphql/dtos/requests/payment-criteria-graphql.dto.ts` — `filters`/`sorts` typed to `PaymentFilterInput`/`PaymentSortInput` via `createFilterInput`/`createSortInput`
- [ ] 4.22 Create `src/contexts/payments/transport/graphql/dtos/requests/subscription-criteria-graphql.dto.ts` — same pattern
- [ ] 4.23 Create `src/contexts/payments/transport/graphql/dtos/responses/payment.response.dto.ts`
- [ ] 4.24 Create `src/contexts/payments/transport/graphql/dtos/responses/subscription.response.dto.ts`
- [ ] 4.25 Create `src/contexts/payments/transport/graphql/mappers/payment.mapper.ts`
- [ ] 4.26 Create `src/contexts/payments/transport/graphql/mappers/subscription.mapper.ts`
- [ ] 4.27 Create `src/contexts/payments/transport/graphql/resolvers/payment-queries.resolver.ts` — `QueryBus` only; `new FilterValidationPipe(paymentFilterableFields)` on the criteria arg
- [ ] 4.28 Create `src/contexts/payments/transport/graphql/resolvers/payment-mutations.resolver.ts` — `CommandBus` only
- [ ] 4.29 Create `src/contexts/payments/transport/graphql/resolvers/subscription-queries.resolver.ts`
- [ ] 4.30 Create `src/contexts/payments/transport/graphql/resolvers/subscription-mutations.resolver.ts`

### MCP (queries only — see design.md Open Questions)
- [ ] 4.31 Create `src/contexts/payments/transport/mcp/schemas/payment-find-by-id.schema.ts` — Zod schema
- [ ] 4.32 Create `src/contexts/payments/transport/mcp/schemas/payment-list.schema.ts`
- [ ] 4.33 Create `src/contexts/payments/transport/mcp/schemas/subscription-find-by-id.schema.ts`
- [ ] 4.34 Create `src/contexts/payments/transport/mcp/schemas/subscription-list.schema.ts`
- [ ] 4.35 Create `src/contexts/payments/transport/mcp/tools/payment-find-by-id.tool.ts` — `payment_find_by_id`, `IMcpTool`, `@McpTool()` + `@Injectable()`, dispatches via `QueryBus`
- [ ] 4.36 Create `src/contexts/payments/transport/mcp/tools/payment-list.tool.ts` — `payment_list`
- [ ] 4.37 Create `src/contexts/payments/transport/mcp/tools/subscription-find-by-id.tool.ts` — `subscription_find_by_id`
- [ ] 4.38 Create `src/contexts/payments/transport/mcp/tools/subscription-list.tool.ts` — `subscription_list`

---

## Phase 5: Module Wiring & Docs

- [ ] 5.1 Create `src/contexts/payments/payments.module.ts` — providers grouped as `COMMAND_HANDLERS`, `QUERY_HANDLERS`, `APPLICATION_SERVICES`, `DOMAIN_BUILDERS`, `INFRASTRUCTURE_REPOSITORIES` (both aggregates' write/read repos bound via `useClass`, `paymentProviderProvider` bound to `PAYMENT_PROVIDER_PORT`), `INFRASTRUCTURE_MAPPERS`, `INFRASTRUCTURE_ENTITIES`, `TRANSPORT_PROVIDERS` (REST + GraphQL + MCP), spread into `@Module`; imports `CqrsModule`, `TypeOrmModule.forFeature(INFRASTRUCTURE_ENTITIES)`, `ConfigModule.forFeature(paymentsConfig)`
- [ ] 5.2 Modify `src/contexts/contexts.module.ts` — add `PaymentsModule` to `CONTEXT_MODULES`
- [ ] 5.3 Create `src/contexts/payments/README.md` — context walkthrough (aggregates, commands, queries, events, endpoints, provider port, webhook flow, idempotency); **explicitly documents the "no auth guard yet" limitation** so it isn't missed by a later reader

---

## Phase 6: Tests

- [ ] 6.1 Unit — `payment-amount.value-object.spec.ts`: positive integers accepted; `0`, negative, and non-integers throw
- [ ] 6.2 Unit — `idempotency-key.value-object.spec.ts`: non-empty accepted; empty/whitespace throws
- [ ] 6.3 Unit — `payment.aggregate.spec.ts`: `create()` emits `PaymentCreated`; `markSucceeded`/`markFailed` emit correctly; `refund()` full and partial emit `PaymentRefunded` with correct resulting `status`; over-refund throws
- [ ] 6.4 Unit — `subscription.aggregate.spec.ts`: `create()` emits `SubscriptionCreated`; `syncStatus()` emits only when status differs (no-op asserted); `cancel()` emits `SubscriptionCanceled`
- [ ] 6.5 Unit — `create-payment.handler.spec.ts`: happy path calls port once and persists; same `idempotencyKey` on retry returns existing record and does NOT call the port again; port throwing → `PaymentProviderException`, nothing persisted
- [ ] 6.6 Unit — `refund-payment.handler.spec.ts`: happy path; id not found → 404; over-refund rejected before calling the port
- [ ] 6.7 Unit — `create-subscription.handler.spec.ts`: happy path; idempotency short-circuit
- [ ] 6.8 Unit — `cancel-subscription.handler.spec.ts`: happy path; id not found → 404
- [ ] 6.9 Unit — `process-payment-provider-webhook-event.handler.spec.ts`: invalid signature throws before any repo call; duplicate `provider_event_id` no-ops without touching the aggregate; each event `type` routes to the correct aggregate method (table-driven test over all six types)
- [ ] 6.10 Unit — `payment-find-by-id.handler.spec.ts` / `payment-find-by-criteria.handler.spec.ts`
- [ ] 6.11 Unit — `subscription-find-by-id.handler.spec.ts` / `subscription-find-by-criteria.handler.spec.ts`
- [ ] 6.12 Unit — `stripe-payment-provider.adapter.spec.ts`: Stripe SDK mocked; idempotency key passed through on create calls; signature verification delegates to `stripe.webhooks.constructEvent` and maps errors to `InvalidWebhookSignatureException`; Stripe event type strings map to the correct normalized `type`
- [ ] 6.13 Integration — `payment-typeorm-write.repository.integration-spec.ts`: `(provider, idempotency_key)` unique constraint rejects a duplicate insert; `findByIdempotencyKey` returns the existing row
- [ ] 6.14 Integration — `payment-typeorm-read.repository.integration-spec.ts`: `status`, `customerId`, `createdAfter`/`createdBefore` filters
- [ ] 6.15 Integration — `subscription-typeorm-write.repository.integration-spec.ts` + `subscription-typeorm-read.repository.integration-spec.ts` — same shape
- [ ] 6.16 Integration — `webhook-event-log.repository.integration-spec.ts`: `(provider, provider_event_id)` unique constraint dedups
- [ ] 6.17 E2E — `payments-rest.e2e-spec.ts`: create/get/list/refund against a stubbed `IPaymentProviderPort`; invalid amount → 400; over-refund → 400; not found → 404
- [ ] 6.18 E2E — `subscriptions-rest.e2e-spec.ts`: create/get/list/cancel against a stubbed port
- [ ] 6.19 E2E — `payments-webhooks.e2e-spec.ts`: valid signature (computed with the test webhook secret) processes and updates the target aggregate; invalid signature → 400, state unchanged; replayed event id → 200, no double state change
- [ ] 6.20 E2E — `payments-graphql.e2e-spec.ts` / `subscriptions-graphql.e2e-spec.ts`: mirrors of the REST flows via GraphQL mutations/queries
- [ ] 6.21 Static — `payments-provider-sdk-isolation.spec.ts`: scan `src/contexts/payments/**`, assert no import of `stripe` outside `infrastructure/adapters/stripe-payment-provider.adapter.ts`
- [ ] 6.22 Static — `payments-no-cross-context-import.spec.ts`: scan `src/contexts/payments/**`, assert no `@contexts/` import outside `@contexts/payments/`
