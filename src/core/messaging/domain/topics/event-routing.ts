import {
  AGGREGATE_MODULE_MAP,
  UNMAPPED_MODULE,
} from '@core/messaging/domain/topics/aggregate-module.map';

export interface IResolvedModule {
  module: string;
  /** True when the aggregate root type had no explicit mapping (fell back to `unmapped`). */
  fallback: boolean;
}

/** Resolves the bounded-context module for an aggregate root type. */
export function resolveModule(aggregateRootType: string): IResolvedModule {
  const module = AGGREGATE_MODULE_MAP[aggregateRootType];
  return module
    ? { module, fallback: false }
    : { module: UNMAPPED_MODULE, fallback: true };
}

/**
 * Derives a kebab-cased action from an event class name, dropping the trailing
 * `Event` suffix. `PlantCreatedEvent` -> `plant-created`,
 * `PlantNameChangedEvent` -> `plant-name-changed`.
 */
export function deriveAction(eventType: string): string {
  return eventType
    .replace(/Event$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}
