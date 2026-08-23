import { BasePrimitives } from '@sisques-labs/nestjs-kit';

/**
 * Serialized (unwrapped) shape of a `UserAggregate`. Value objects are
 * flattened to their raw `.value` here — this is what crosses the
 * domain/infrastructure boundary (persistence mappers, event payloads).
 * `email` stays nullable — `IPrincipal.email` already is (see
 * `add-core-identity-module`), and this context never invents one.
 * `avatarUrl` is nullable and user-owned (like `displayName`) — there is
 * no IdP claim for it, so it starts `null` and is only ever set via
 * `PATCH /users/me`.
 */
export type UserPrimitives = BasePrimitives & {
  tenantId: string;
  externalId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
};
