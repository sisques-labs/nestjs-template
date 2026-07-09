import { IOutboundEvent } from '@core/messaging/domain/interfaces/outbound-event.interface';

export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');

/**
 * Port for publishing domain events to an external message broker. Implemented in
 * infrastructure (Kafka via kafkajs, or a no-op when forwarding is disabled).
 *
 * Implementations MUST be best-effort: a publish failure is logged by the caller
 * and never propagated to the command flow (the in-process `EventBus` already
 * delivered the event). The broker is a secondary, downstream consumer.
 */
export interface IEventPublisher {
  publish(event: IOutboundEvent): Promise<void>;
}
