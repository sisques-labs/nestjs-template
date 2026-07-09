import { IKafkaConfig } from '@core/config/kafka.config';
import { IOutboundEvent } from '@core/messaging/domain/interfaces/outbound-event.interface';
import {
  EVENT_PUBLISHER,
  IEventPublisher,
} from '@core/messaging/domain/ports/event-publisher.port';
import {
  deriveAction,
  resolveModule,
} from '@core/messaging/domain/topics/event-routing';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBus, IEvent } from '@nestjs/cqrs';
import { Subscription } from 'rxjs';

/** Structural shape of a `BaseEvent` (nestjs-kit) — the fields the forwarder reads. */
interface DomainEventLike {
  eventId: string;
  eventType: string;
  aggregateRootId: string;
  aggregateRootType: string;
  ocurredAt: Date;
  entityId: string;
  entityType: string;
  schemaVersion: string;
  correlationId: string | null;
  causationId: string | null;
  data: unknown;
}

function isDomainEvent(event: IEvent): event is IEvent & DomainEventLike {
  const candidate = event as Partial<DomainEventLike>;
  return (
    typeof candidate.eventId === 'string' &&
    typeof candidate.eventType === 'string' &&
    typeof candidate.aggregateRootId === 'string' &&
    typeof candidate.aggregateRootType === 'string'
  );
}

/**
 * Forwards every domain event published on the in-process `@nestjs/cqrs` `EventBus`
 * to an external broker, in addition to in-process delivery. It subscribes to the
 * shared `EventBus` stream (it extends `Observable`) — **no command handler or
 * aggregate is edited**, mirroring `CqrsMetricsService`.
 *
 * Forwarding is best-effort: a publish failure is logged and swallowed so the
 * command flow is never affected. When `KAFKA_ENABLED` is false the forwarder does
 * not subscribe at all (zero overhead).
 */
@Injectable()
export class DomainEventForwarderService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DomainEventForwarderService.name);
  private subscription?: Subscription;
  private readonly warnedUnmappedTypes = new Set<string>();

  constructor(
    private readonly eventBus: EventBus,
    private readonly configService: ConfigService,
    @Inject(EVENT_PUBLISHER)
    private readonly publisher: IEventPublisher,
  ) {}

  onModuleInit(): void {
    const enabled =
      this.configService.get<IKafkaConfig>('kafka')?.enabled ?? false;
    if (!enabled) {
      this.logger.log(
        'Kafka event forwarding disabled (KAFKA_ENABLED!=true) — not subscribing',
      );
      return;
    }

    this.subscription = this.eventBus.subscribe((event: IEvent) => {
      void this.forward(event);
    });
    this.logger.log('Kafka event forwarding enabled — subscribed to EventBus');
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private async forward(event: IEvent): Promise<void> {
    if (!isDomainEvent(event)) {
      return;
    }

    const outbound = this.toOutboundEvent(event);

    if (
      outbound.module === 'unmapped' &&
      !this.warnedUnmappedTypes.has(event.aggregateRootType)
    ) {
      this.warnedUnmappedTypes.add(event.aggregateRootType);
      this.logger.warn(
        `No module mapping for "${event.aggregateRootType}" — routing "${event.eventType}" to the "unmapped" topic. Add it to AGGREGATE_MODULE_MAP.`,
      );
    }

    try {
      await this.publisher.publish(outbound);
    } catch (error) {
      this.logger.error(
        `Failed to forward "${outbound.eventType}" (${outbound.eventId}) to Kafka: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private toOutboundEvent(event: DomainEventLike): IOutboundEvent {
    return {
      module: resolveModule(event.aggregateRootType).module,
      action: deriveAction(event.eventType),
      eventType: event.eventType,
      eventId: event.eventId,
      aggregateRootId: event.aggregateRootId,
      aggregateRootType: event.aggregateRootType,
      entityId: event.entityId,
      entityType: event.entityType,
      schemaVersion: event.schemaVersion,
      occurredAt: event.ocurredAt,
      correlationId: event.correlationId,
      causationId: event.causationId,
      data: event.data,
    };
  }
}
