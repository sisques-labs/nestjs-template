import { CommandBus, EventBus, QueryBus } from '@nestjs/cqrs';
import { Counter, Histogram } from 'prom-client';
import { Subject } from 'rxjs';

import { CqrsMetricsService } from './cqrs-metrics.service';

class CreateOrderCommand {}
class GetOrderQuery {}
class OrderCreatedEvent {}

describe('CqrsMetricsService', () => {
  let commandBus: { execute: jest.Mock };
  let queryBus: { execute: jest.Mock };
  let eventStream: Subject<unknown>;
  let eventBus: EventBus;
  let duration: jest.Mocked<Histogram<string>>;
  let total: jest.Mocked<Counter<string>>;
  let events: jest.Mocked<Counter<string>>;
  let service: CqrsMetricsService;

  beforeEach(() => {
    commandBus = { execute: jest.fn().mockResolvedValue('command-result') };
    queryBus = { execute: jest.fn().mockResolvedValue('query-result') };
    eventStream = new Subject<unknown>();
    eventBus = {
      subscribe: (fn: (event: unknown) => void) => eventStream.subscribe(fn),
    } as unknown as EventBus;

    duration = { observe: jest.fn() } as unknown as jest.Mocked<
      Histogram<string>
    >;
    total = { inc: jest.fn() } as unknown as jest.Mocked<Counter<string>>;
    events = { inc: jest.fn() } as unknown as jest.Mocked<Counter<string>>;

    service = new CqrsMetricsService(
      commandBus as unknown as CommandBus,
      queryBus as unknown as QueryBus,
      eventBus,
      duration,
      total,
      events,
    );
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('commands', () => {
    it('records a successful command with its class name and success status', async () => {
      const result = await commandBus.execute(new CreateOrderCommand());

      expect(result).toBe('command-result');
      const labels = {
        type: 'CreateOrderCommand',
        kind: 'command',
        status: 'success',
      };
      expect(total.inc).toHaveBeenCalledWith(labels);
      expect(duration.observe).toHaveBeenCalledWith(labels, expect.any(Number));
    });

    it('records an error status and rethrows when the handler fails', async () => {
      const failingBus = {
        execute: jest.fn().mockRejectedValue(new Error('handler failed')),
      };
      service.instrument(failingBus, 'command');

      await expect(
        failingBus.execute(new CreateOrderCommand()),
      ).rejects.toThrow('handler failed');

      expect(total.inc).toHaveBeenCalledWith({
        type: 'CreateOrderCommand',
        kind: 'command',
        status: 'error',
      });
    });
  });

  describe('queries', () => {
    it('records a successful query with kind=query', async () => {
      await queryBus.execute(new GetOrderQuery());

      expect(total.inc).toHaveBeenCalledWith({
        type: 'GetOrderQuery',
        kind: 'query',
        status: 'success',
      });
    });
  });

  describe('events', () => {
    it('counts a published event by its class name', () => {
      eventStream.next(new OrderCreatedEvent());

      expect(events.inc).toHaveBeenCalledWith({ event: 'OrderCreatedEvent' });
    });

    it('stops counting after destroy', () => {
      service.onModuleDestroy();
      eventStream.next(new OrderCreatedEvent());

      expect(events.inc).not.toHaveBeenCalled();
    });
  });
});
