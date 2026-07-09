/**
 * Maps each aggregate root type to its bounded-context module. The module becomes
 * the Kafka topic suffix (`${prefix}.${module}`).
 *
 * A `BaseEvent` only carries `aggregateRootType` (e.g. `PlantAggregate`), not the
 * owning context, so the routing table is materialised explicitly — but it is
 * **auto-generated**, not hand-maintained. The generator derives it from the
 * folder layout (`src/contexts/<module>/domain/aggregates/*.aggregate.ts`), so
 * creating a new module/aggregate requires no edit here: the pre-commit hook and
 * CI (`pnpm gen:topics:check`) keep `aggregate-module.map.generated.ts` in sync.
 * An aggregate that is somehow missing falls back to the `unmapped` topic with a
 * warning.
 *
 * @see scripts/generate-aggregate-module-map.ts
 */
export { AGGREGATE_MODULE_MAP } from '@core/messaging/domain/topics/aggregate-module.map.generated';

/** Module used when an aggregate root type has no explicit mapping. */
export const UNMAPPED_MODULE = 'unmapped';
