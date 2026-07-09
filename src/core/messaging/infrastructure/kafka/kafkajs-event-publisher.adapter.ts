import { IKafkaConfig } from '@core/config/kafka.config';
import { IOutboundEvent } from '@core/messaging/domain/interfaces/outbound-event.interface';
import { IEventPublisher } from '@core/messaging/domain/ports/event-publisher.port';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, RecordMetadata, SASLOptions } from 'kafkajs';

/**
 * Publishes outbound domain events to Kafka via kafkajs.
 *
 * - Topic: `${topicPrefix}.${module}` (e.g. `nestjs-template.plants`).
 * - Partition key: `aggregateRootId` — preserves per-entity ordering.
 * - Action (`plant-updated`) and all metadata travel in message headers; the full
 *   envelope (metadata + payload) is the JSON value.
 *
 * Connection is best-effort: a failed `connect()` at boot does not crash the app
 * (kafkajs lazily reconnects on `send`). Publish errors propagate to the forwarder,
 * which logs and swallows them.
 *
 * When `KAFKA_ENABLED` is false the producer is never created and every method is a
 * no-op, so the app boots without a broker (the forwarder also never subscribes).
 */
@Injectable()
export class KafkajsEventPublisherAdapter
  implements IEventPublisher, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(KafkajsEventPublisherAdapter.name);
  private readonly config: IKafkaConfig;
  private readonly producer: Producer | null;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<IKafkaConfig>('kafka');
    this.producer = this.config.enabled ? this.createProducer() : null;
  }

  private createProducer(): Producer {
    const kafka = new Kafka({
      clientId: this.config.clientId,
      brokers: this.config.brokers,
      ssl: this.config.ssl,
      ...(this.config.sasl ? { sasl: this.config.sasl as SASLOptions } : {}),
    });
    return kafka.producer({ allowAutoTopicCreation: true });
  }

  async onModuleInit(): Promise<void> {
    if (!this.producer) {
      return;
    }
    try {
      await this.producer.connect();
      this.logger.log(
        `Kafka producer connected (brokers: ${this.config.brokers.join(', ')})`,
      );
    } catch (error) {
      this.logger.warn(
        `Kafka producer failed to connect at startup, will retry on publish: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.producer) {
      return;
    }
    try {
      await this.producer.disconnect();
    } catch (error) {
      this.logger.warn(
        `Kafka producer failed to disconnect cleanly: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async publish(event: IOutboundEvent): Promise<void> {
    if (!this.producer) {
      return;
    }
    const topic = `${this.config.topicPrefix}.${event.module}`;
    const result: RecordMetadata[] = await this.producer.send({
      topic,
      messages: [
        {
          key: event.aggregateRootId,
          headers: this.buildHeaders(event),
          value: JSON.stringify(this.buildEnvelope(event)),
        },
      ],
    });
    this.logger.debug(
      `Published "${event.action}" to "${topic}" (key=${event.aggregateRootId}, partition=${result[0]?.partition ?? '?'})`,
    );
  }

  private buildHeaders(event: IOutboundEvent): Record<string, string> {
    const headers: Record<string, string> = {
      'event-id': event.eventId,
      'event-type': event.action,
      'event-class': event.eventType,
      'aggregate-type': event.aggregateRootType,
      'entity-id': event.entityId,
      'entity-type': event.entityType,
      'schema-version': event.schemaVersion,
      'occurred-at': event.occurredAt.toISOString(),
    };
    if (event.correlationId) {
      headers['correlation-id'] = event.correlationId;
    }
    if (event.causationId) {
      headers['causation-id'] = event.causationId;
    }
    return headers;
  }

  private buildEnvelope(event: IOutboundEvent): Record<string, unknown> {
    return {
      eventId: event.eventId,
      eventType: event.eventType,
      action: event.action,
      module: event.module,
      aggregateRootId: event.aggregateRootId,
      aggregateRootType: event.aggregateRootType,
      entityId: event.entityId,
      entityType: event.entityType,
      schemaVersion: event.schemaVersion,
      occurredAt: event.occurredAt.toISOString(),
      correlationId: event.correlationId,
      causationId: event.causationId,
      data: event.data,
    };
  }
}
