import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CancelSubscriptionCommandHandler } from '@contexts/payments/application/commands/cancel-subscription/cancel-subscription.handler';
import { CreatePaymentCommandHandler } from '@contexts/payments/application/commands/create-payment/create-payment.handler';
import { CreateSubscriptionCommandHandler } from '@contexts/payments/application/commands/create-subscription/create-subscription.handler';
import { ProcessPaymentProviderWebhookEventCommandHandler } from '@contexts/payments/application/commands/process-payment-provider-webhook-event/process-payment-provider-webhook-event.handler';
import { RefundPaymentCommandHandler } from '@contexts/payments/application/commands/refund-payment/refund-payment.handler';
import { PaymentFindByCriteriaQueryHandler } from '@contexts/payments/application/queries/payment-find-by-criteria/payment-find-by-criteria.handler';
import { PaymentFindByIdQueryHandler } from '@contexts/payments/application/queries/payment-find-by-id/payment-find-by-id.handler';
import { SubscriptionFindByCriteriaQueryHandler } from '@contexts/payments/application/queries/subscription-find-by-criteria/subscription-find-by-criteria.handler';
import { SubscriptionFindByIdQueryHandler } from '@contexts/payments/application/queries/subscription-find-by-id/subscription-find-by-id.handler';
import { AssertPaymentViewModelExistsService } from '@contexts/payments/application/services/read/assert-payment-view-model-exists/assert-payment-view-model-exists.service';
import { AssertSubscriptionViewModelExistsService } from '@contexts/payments/application/services/read/assert-subscription-view-model-exists/assert-subscription-view-model-exists.service';
import { AssertPaymentExistsService } from '@contexts/payments/application/services/write/assert-payment-exists/assert-payment-exists.service';
import { AssertSubscriptionExistsService } from '@contexts/payments/application/services/write/assert-subscription-exists/assert-subscription-exists.service';
import { PaymentBuilder } from '@contexts/payments/domain/builders/payment.builder';
import { SubscriptionBuilder } from '@contexts/payments/domain/builders/subscription.builder';
import { PAYMENT_READ_REPOSITORY } from '@contexts/payments/domain/repositories/read/payment-read.repository';
import { SUBSCRIPTION_READ_REPOSITORY } from '@contexts/payments/domain/repositories/read/subscription-read.repository';
import { WEBHOOK_EVENT_LOG_REPOSITORY } from '@contexts/payments/domain/repositories/webhook-event-log.repository';
import { PAYMENT_WRITE_REPOSITORY } from '@contexts/payments/domain/repositories/write/payment-write.repository';
import { SUBSCRIPTION_WRITE_REPOSITORY } from '@contexts/payments/domain/repositories/write/subscription-write.repository';
import { StripePaymentProviderAdapter } from '@contexts/payments/infrastructure/adapters/stripe-payment-provider.adapter';
import { paymentProviderProvider } from '@contexts/payments/infrastructure/config/payment-provider.provider';
import { paymentsConfig } from '@contexts/payments/infrastructure/config/payments.config';
import { PaymentWebhookEventTypeOrmEntity } from '@contexts/payments/infrastructure/persistence/typeorm/entities/payment-webhook-event.entity';
import { PaymentTypeOrmEntity } from '@contexts/payments/infrastructure/persistence/typeorm/entities/payment.entity';
import { SubscriptionTypeOrmEntity } from '@contexts/payments/infrastructure/persistence/typeorm/entities/subscription.entity';
import { PaymentTypeOrmMapper } from '@contexts/payments/infrastructure/persistence/typeorm/mappers/payment-typeorm.mapper';
import { SubscriptionTypeOrmMapper } from '@contexts/payments/infrastructure/persistence/typeorm/mappers/subscription-typeorm.mapper';
import { PaymentTypeOrmReadRepository } from '@contexts/payments/infrastructure/persistence/typeorm/repositories/payment-typeorm-read.repository';
import { PaymentTypeOrmWriteRepository } from '@contexts/payments/infrastructure/persistence/typeorm/repositories/payment-typeorm-write.repository';
import { SubscriptionTypeOrmReadRepository } from '@contexts/payments/infrastructure/persistence/typeorm/repositories/subscription-typeorm-read.repository';
import { SubscriptionTypeOrmWriteRepository } from '@contexts/payments/infrastructure/persistence/typeorm/repositories/subscription-typeorm-write.repository';
import { WebhookEventLogRepository } from '@contexts/payments/infrastructure/persistence/webhook-event-log.repository';
import '@contexts/payments/transport/graphql/enums/payments-registered-enums.graphql';
import { PaymentGraphQLMapper } from '@contexts/payments/transport/graphql/mappers/payment.mapper';
import { SubscriptionGraphQLMapper } from '@contexts/payments/transport/graphql/mappers/subscription.mapper';
import { PaymentMutationsResolver } from '@contexts/payments/transport/graphql/resolvers/payment-mutations.resolver';
import { PaymentQueriesResolver } from '@contexts/payments/transport/graphql/resolvers/payment-queries.resolver';
import { SubscriptionMutationsResolver } from '@contexts/payments/transport/graphql/resolvers/subscription-mutations.resolver';
import { SubscriptionQueriesResolver } from '@contexts/payments/transport/graphql/resolvers/subscription-queries.resolver';
import { PaymentFindByCriteriaMcpTool } from '@contexts/payments/transport/mcp/tools/payment-find-by-criteria.tool';
import { PaymentFindByIdMcpTool } from '@contexts/payments/transport/mcp/tools/payment-find-by-id.tool';
import { SubscriptionFindByCriteriaMcpTool } from '@contexts/payments/transport/mcp/tools/subscription-find-by-criteria.tool';
import { SubscriptionFindByIdMcpTool } from '@contexts/payments/transport/mcp/tools/subscription-find-by-id.tool';
import { PaymentsWebhooksController } from '@contexts/payments/transport/rest/controllers/payments-webhooks.controller';
import { PaymentsController } from '@contexts/payments/transport/rest/controllers/payments.controller';
import { SubscriptionsController } from '@contexts/payments/transport/rest/controllers/subscriptions.controller';
import { PaymentRestMapper } from '@contexts/payments/transport/rest/mappers/payment/payment.mapper';
import { SubscriptionRestMapper } from '@contexts/payments/transport/rest/mappers/subscription/subscription.mapper';

const COMMAND_HANDLERS = [
  CreatePaymentCommandHandler,
  RefundPaymentCommandHandler,
  CreateSubscriptionCommandHandler,
  CancelSubscriptionCommandHandler,
  ProcessPaymentProviderWebhookEventCommandHandler,
];

const QUERY_HANDLERS = [
  PaymentFindByIdQueryHandler,
  PaymentFindByCriteriaQueryHandler,
  SubscriptionFindByIdQueryHandler,
  SubscriptionFindByCriteriaQueryHandler,
];

const DOMAIN_BUILDERS = [PaymentBuilder, SubscriptionBuilder];

const APPLICATION_SERVICES = [
  AssertPaymentExistsService,
  AssertSubscriptionExistsService,
  AssertPaymentViewModelExistsService,
  AssertSubscriptionViewModelExistsService,
];

const INFRASTRUCTURE_MAPPERS = [
  PaymentTypeOrmMapper,
  SubscriptionTypeOrmMapper,
];

const INFRASTRUCTURE_REPOSITORIES = [
  {
    provide: PAYMENT_WRITE_REPOSITORY,
    useClass: PaymentTypeOrmWriteRepository,
  },
  { provide: PAYMENT_READ_REPOSITORY, useClass: PaymentTypeOrmReadRepository },
  {
    provide: SUBSCRIPTION_WRITE_REPOSITORY,
    useClass: SubscriptionTypeOrmWriteRepository,
  },
  {
    provide: SUBSCRIPTION_READ_REPOSITORY,
    useClass: SubscriptionTypeOrmReadRepository,
  },
  {
    provide: WEBHOOK_EVENT_LOG_REPOSITORY,
    useClass: WebhookEventLogRepository,
  },
];

// The Stripe adapter is registered as an ordinary provider (so Nest can
// construct it) AND selected behind PAYMENT_PROVIDER_PORT via the factory
// below — the factory is the only thing application code depends on.
const INFRASTRUCTURE_PROVIDERS = [
  StripePaymentProviderAdapter,
  paymentProviderProvider,
];

const INFRASTRUCTURE_ENTITIES = [
  PaymentTypeOrmEntity,
  SubscriptionTypeOrmEntity,
  PaymentWebhookEventTypeOrmEntity,
];

const REST_CONTROLLERS = [
  PaymentsController,
  SubscriptionsController,
  PaymentsWebhooksController,
];
const REST_PROVIDERS = [PaymentRestMapper, SubscriptionRestMapper];

const GRAPHQL_PROVIDERS = [
  PaymentQueriesResolver,
  PaymentMutationsResolver,
  SubscriptionQueriesResolver,
  SubscriptionMutationsResolver,
  PaymentGraphQLMapper,
  SubscriptionGraphQLMapper,
];

const MCP_TOOLS = [
  PaymentFindByIdMcpTool,
  PaymentFindByCriteriaMcpTool,
  SubscriptionFindByIdMcpTool,
  SubscriptionFindByCriteriaMcpTool,
];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature(INFRASTRUCTURE_ENTITIES),
    ConfigModule.forFeature(paymentsConfig),
  ],
  controllers: [...REST_CONTROLLERS],
  providers: [
    ...COMMAND_HANDLERS,
    ...QUERY_HANDLERS,
    ...DOMAIN_BUILDERS,
    ...APPLICATION_SERVICES,
    ...INFRASTRUCTURE_MAPPERS,
    ...INFRASTRUCTURE_REPOSITORIES,
    ...INFRASTRUCTURE_PROVIDERS,
    ...REST_PROVIDERS,
    ...GRAPHQL_PROVIDERS,
    ...MCP_TOOLS,
  ],
  exports: [],
})
export class PaymentsModule {}
