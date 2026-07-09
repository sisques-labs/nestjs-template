import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CommandBus, EventBus, IEvent, QueryBus } from '@nestjs/cqrs';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Subscription } from 'rxjs';

import {
  CQRS_EVENTS_PUBLISHED_TOTAL,
  CQRS_HANDLER_DURATION,
  CQRS_HANDLER_TOTAL,
} from '../../domain/constants/metrics.constants';
import { CqrsKind } from '../../domain/types/cqrs-kind.type';
import { CqrsStatus } from '../../domain/types/cqrs-status.type';

/** A payload (command/query) dispatched through a CQRS bus. */
interface DispatchPayload {
  constructor: { name: string };
}

type ExecuteFn = (payload: DispatchPayload) => Promise<unknown>;

/** Minimal structural view of the part of a bus we wrap. */
interface ExecutableBus {
  execute: ExecuteFn;
}

/**
 * Instruments CQRS without editing any handler.
 *
 * `@nestjs/cqrs@10` registers handlers onto the global, exported `CommandBus`/
 * `QueryBus` singletons and has no command/query middleware. A DI override
 * (`{ provide: CommandBus, useClass: ... }`) would create a *second* instance
 * with no handlers registered, so instead we wrap the `execute` method of the
 * single shared instances at startup. Domain events are counted by subscribing
 * to the `EventBus` stream (it extends `Observable`).
 */
@Injectable()
export class CqrsMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CqrsMetricsService.name);
  private subscription?: Subscription;

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly eventBus: EventBus,
    @InjectMetric(CQRS_HANDLER_DURATION)
    private readonly duration: Histogram<string>,
    @InjectMetric(CQRS_HANDLER_TOTAL)
    private readonly total: Counter<string>,
    @InjectMetric(CQRS_EVENTS_PUBLISHED_TOTAL)
    private readonly events: Counter<string>,
  ) {}

  onModuleInit(): void {
    this.instrument(this.commandBus as unknown as ExecutableBus, 'command');
    this.instrument(this.queryBus as unknown as ExecutableBus, 'query');
    this.subscription = this.eventBus.subscribe((event: IEvent) => {
      this.events.inc({ event: event.constructor.name });
    });
    this.logger.log('CQRS metrics instrumentation enabled');
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /** Wraps a bus's `execute` to record duration + count, preserving behaviour. */
  instrument(bus: ExecutableBus, kind: CqrsKind): void {
    const original = bus.execute.bind(bus);
    bus.execute = async (payload: DispatchPayload): Promise<unknown> => {
      const type = payload.constructor.name;
      const start = process.hrtime.bigint();
      try {
        const result = await original(payload);
        this.observe(type, kind, 'success', start);
        return result;
      } catch (error) {
        this.observe(type, kind, 'error', start);
        throw error;
      }
    };
  }

  private observe(
    type: string,
    kind: CqrsKind,
    status: CqrsStatus,
    start: bigint,
  ): void {
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    const labels = { type, kind, status };
    this.duration.observe(labels, seconds);
    this.total.inc(labels);
  }
}
