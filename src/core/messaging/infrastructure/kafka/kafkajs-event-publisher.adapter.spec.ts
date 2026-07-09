import { ConfigService } from '@nestjs/config';
import { Kafka } from 'kafkajs';

import { IKafkaConfig } from '@core/config/kafka.config';
import { IOutboundEvent } from '@core/messaging/domain/interfaces/outbound-event.interface';

import { KafkajsEventPublisherAdapter } from './kafkajs-event-publisher.adapter';

jest.mock('kafkajs');

const KAFKA_CONFIG: IKafkaConfig = {
  enabled: true,
  clientId: 'nestjs-template',
  brokers: ['localhost:9092'],
  topicPrefix: 'nestjs-template',
  ssl: false,
  sasl: null,
};

function makeOutboundEvent(
  overrides: Partial<IOutboundEvent> = {},
): IOutboundEvent {
  return {
    module: 'orders',
    action: 'order-updated',
    eventType: 'OrderUpdatedEvent',
    eventId: 'evt-1',
    aggregateRootId: 'order-1',
    aggregateRootType: 'OrderAggregate',
    entityId: 'order-1',
    entityType: 'OrderAggregate',
    schemaVersion: '1',
    occurredAt: new Date('2026-06-25T00:00:00.000Z'),
    correlationId: null,
    causationId: null,
    data: { id: 'order-1', total: 42 },
    ...overrides,
  };
}

describe('KafkajsEventPublisherAdapter', () => {
  const producer = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue([{ partition: 0 }]),
  };
  let adapter: KafkajsEventPublisherAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    (Kafka as unknown as jest.Mock).mockImplementation(() => ({
      producer: () => producer,
    }));

    const configService = {
      getOrThrow: jest.fn().mockReturnValue(KAFKA_CONFIG),
    } as unknown as ConfigService;

    adapter = new KafkajsEventPublisherAdapter(configService);
  });

  it('connects the producer on init (best-effort, swallows errors)', async () => {
    producer.connect.mockRejectedValueOnce(new Error('no broker'));

    await expect(adapter.onModuleInit()).resolves.toBeUndefined();
    expect(producer.connect).toHaveBeenCalledTimes(1);
  });

  it('disconnects the producer on destroy', async () => {
    await adapter.onModuleDestroy();
    expect(producer.disconnect).toHaveBeenCalledTimes(1);
  });

  it('publishes to ${prefix}.${module} keyed by aggregateRootId', async () => {
    await adapter.publish(makeOutboundEvent());

    expect(producer.send).toHaveBeenCalledTimes(1);
    const sent = producer.send.mock.calls[0][0];
    expect(sent.topic).toBe('nestjs-template.orders');
    expect(sent.messages[0].key).toBe('order-1');
  });

  it('carries the action and metadata in headers', async () => {
    await adapter.publish(makeOutboundEvent());

    const { headers } = producer.send.mock.calls[0][0].messages[0];
    expect(headers).toMatchObject({
      'event-id': 'evt-1',
      'event-type': 'order-updated',
      'event-class': 'OrderUpdatedEvent',
      'aggregate-type': 'OrderAggregate',
      'occurred-at': '2026-06-25T00:00:00.000Z',
    });
    expect(headers).not.toHaveProperty('correlation-id');
  });

  it('includes correlation/causation headers when present', async () => {
    await adapter.publish(
      makeOutboundEvent({ correlationId: 'corr-1', causationId: 'cause-1' }),
    );

    const { headers } = producer.send.mock.calls[0][0].messages[0];
    expect(headers['correlation-id']).toBe('corr-1');
    expect(headers['causation-id']).toBe('cause-1');
  });

  it('serializes the full envelope as the JSON value', async () => {
    await adapter.publish(makeOutboundEvent());

    const { value } = producer.send.mock.calls[0][0].messages[0];
    expect(JSON.parse(value)).toMatchObject({
      eventId: 'evt-1',
      eventType: 'OrderUpdatedEvent',
      action: 'order-updated',
      module: 'orders',
      occurredAt: '2026-06-25T00:00:00.000Z',
      data: { id: 'order-1', total: 42 },
    });
  });

  describe('when Kafka is disabled', () => {
    let disabledAdapter: KafkajsEventPublisherAdapter;

    beforeEach(() => {
      (Kafka as unknown as jest.Mock).mockClear();
      const configService = {
        getOrThrow: jest
          .fn()
          .mockReturnValue({ ...KAFKA_CONFIG, enabled: false }),
      } as unknown as ConfigService;
      disabledAdapter = new KafkajsEventPublisherAdapter(configService);
    });

    it('never creates a Kafka producer', () => {
      expect(Kafka).not.toHaveBeenCalled();
    });

    it('is a no-op on init, publish and destroy', async () => {
      await disabledAdapter.onModuleInit();
      await disabledAdapter.publish(makeOutboundEvent());
      await disabledAdapter.onModuleDestroy();

      expect(producer.connect).not.toHaveBeenCalled();
      expect(producer.send).not.toHaveBeenCalled();
      expect(producer.disconnect).not.toHaveBeenCalled();
    });
  });
});
