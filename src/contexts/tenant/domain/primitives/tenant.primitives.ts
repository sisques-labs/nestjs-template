import { BasePrimitives } from '@sisques-labs/nestjs-kit';

/**
 * Serialized (unwrapped) shape of a `TenantAggregate`. Value objects are
 * flattened to their raw `.value` here — this is what crosses the
 * domain/infrastructure boundary (persistence mappers, event payloads).
 */
export type TenantPrimitives = BasePrimitives & {
  externalId: string;
};
