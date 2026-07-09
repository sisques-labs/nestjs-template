import { appConfig } from '@core/config/app.config';
import { validateEnv } from '@core/config/env.validation';
import { kafkaConfig } from '@core/config/kafka.config';
import { postgresConfig } from '@core/config/postgres.config';
import { sentryConfig } from '@core/config/sentry.config';
import { HealthModule } from '@core/health/health.module';
import { MessagingModule } from '@core/messaging/messaging.module';
import { MetricsModule } from '@core/metrics/metrics.module';
import { ObservabilityModule } from '@core/observability/observability.module';
import { PingResolver } from '@core/transport/graphql/resolvers/ping.resolver';
import '@core/transport/graphql/registered-enums.graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SharedGraphQLModule } from '@sisques-labs/nestjs-kit/graphql';
import { McpModule } from '@sisques-labs/nestjs-kit/mcp';
import { SupportModule } from './support/support.module';

@Module({
  imports: [
    SupportModule,
    CqrsModule.forRoot(),
    SharedGraphQLModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [postgresConfig, appConfig, sentryConfig, kafkaConfig],
      cache: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.getOrThrow<TypeOrmModuleOptions>('postgres'),
    }),
    // REST controllers are documented via Swagger (see main.ts). GraphQL is
    // wired alongside it — drop whichever transport this service doesn't use.
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      playground: true,
      context: ({ req, res }: { req: Request; res: Response }) => ({
        req,
        res,
      }),
    }),
    ObservabilityModule,
    MetricsModule,
    MessagingModule,
    HealthModule,
    // No auth yet, so the default context builder (`{ requestId }`) is used —
    // pass `contextBuilder` here once this service resolves an identity.
    McpModule.forRoot({ name: 'nestjs-template', version: '0.1.0' }),
  ],
  providers: [PingResolver],
})
export class AppModule {}
