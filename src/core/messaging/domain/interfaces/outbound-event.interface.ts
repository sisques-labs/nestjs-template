/**
 * Transport-agnostic representation of a domain event ready to be published to an
 * external broker. Built by the forwarder from a `BaseEvent`; the infrastructure
 * adapter maps it to a concrete wire format (topic, key, headers, payload).
 */
export interface IOutboundEvent {
  /** Bounded-context module the event originates from (e.g. `plants`). Becomes the topic suffix. */
  module: string;
  /** Kebab-cased action derived from the event type (e.g. `plant-updated`). Routed via header. */
  action: string;
  /** Raw event class name (e.g. `PlantUpdatedEvent`). */
  eventType: string;
  /** Unique event id — natural message key candidate / dedup hint. */
  eventId: string;
  /** Aggregate root id — used as the partition key to preserve per-entity ordering. */
  aggregateRootId: string;
  /** Aggregate root class name (e.g. `PlantAggregate`). */
  aggregateRootType: string;
  entityId: string;
  entityType: string;
  schemaVersion: string;
  occurredAt: Date;
  correlationId: string | null;
  causationId: string | null;
  /** The event payload (primitives). */
  data: unknown;
}
