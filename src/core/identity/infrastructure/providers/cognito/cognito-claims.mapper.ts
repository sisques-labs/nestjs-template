import { JWTPayload } from 'jose';

import { IPrincipal } from '../../../application/ports/principal.interface';
import { mapRoleNames } from '../shared/map-role-names';

/**
 * Maps a verified Cognito access token's claims onto the shared
 * `IPrincipal` shape. Groups come from the `cognito:groups` claim; Cognito
 * has no built-in tenant concept, so `tenantId` falls back to the
 * `custom:tenant_id` attribute when the pool defines one.
 */
export function mapCognitoClaimsToPrincipal(payload: JWTPayload): IPrincipal {
  const groups = payload['cognito:groups'];
  const tenantId = payload['custom:tenant_id'];

  return {
    sub: String(payload.sub),
    email: typeof payload.email === 'string' ? payload.email : null,
    roles: mapRoleNames(
      Array.isArray(groups) ? (groups as string[]) : undefined,
    ),
    tenantId: typeof tenantId === 'string' ? tenantId : null,
  };
}
