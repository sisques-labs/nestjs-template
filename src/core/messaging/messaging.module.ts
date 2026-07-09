import { DomainEventForwarderService } from '@core/messaging/application/services/domain-event-forwarder.service';
import { EVENT_PUBLISHER } from '@core/messaging/domain/ports/event-publisher.port';
import { KafkajsEventPublisherAdapter } from '@core/messaging/infrastructure/kafka/kafkajs-event-publisher.adapter';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

/**
 * Bridges the in-process `@nestjs/cqrs` `EventBus` to Kafka. `DomainEventForwarderService`
 * subscribes to every published domain event and republishes it through the
 * `EVENT_PUBLISHER` port, in addition to in-process delivery.
 *
 * Forwarding is opt-in via `KAFKA_ENABLED` (the adapter is a no-op and never opens a
 * connection when disabled), so no broker is required to boot locally or in tests.
 * Topics are `${KAFKA_TOPIC_PREFIX}.${module}` (e.g. `nestjs-template.plants`); the
 * action lives in the `event-type` header.
 */
const APPLICATION_SERVICES = [DomainEventForwarderService];

const INFRASTRUCTURE_ADAPTERS = [
  { provide: EVENT_PUBLISHER, useClass: KafkajsEventPublisherAdapter },
];

@Module({
  imports: [CqrsModule],
  providers: [...APPLICATION_SERVICES, ...INFRASTRUCTURE_ADAPTERS],
})
export class MessagingModule {}
