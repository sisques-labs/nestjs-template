import { JWTPayload } from 'jose';

import { IPrincipal } from '../../../application/interfaces/principal.interface';
import { mapRoleNames } from '../shared/map-role-names';

/**
 * Maps a verified Cognito access token's claims onto the shared
 * `IPrincipal` shape. Groups come from the `cognito:groups` claim; Cognito
 * has no built-in tenant concept, so `tenantIds` falls back to the
 * `custom:tenant_id` attribute when the pool defines one.
 *
 * Cognito custom attributes are string-only (no native array type), so a
 * principal belonging to multiple tenants is represented as a
 * comma-separated list in that single string claim (e.g. `"t-1,t-2"`).
 * Values are split on `,`, trimmed, and empty entries dropped; a single
 * value (no comma) yields a one-element array, and a missing/blank claim
 * yields an empty array.
 */
export function mapCognitoClaimsToPrincipal(payload: JWTPayload): IPrincipal {
  const groups = payload['cognito:groups'];
  const tenantIdsClaim = payload['custom:tenant_id'];

  return {
    sub: String(payload.sub),
    email: typeof payload.email === 'string' ? payload.email : null,
    roles: mapRoleNames(
      Array.isArray(groups) ? (groups as string[]) : undefined,
    ),
    tenantIds:
      typeof tenantIdsClaim === 'string'
        ? tenantIdsClaim
            .split(',')
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        : [],
  };
}
