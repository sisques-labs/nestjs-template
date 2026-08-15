import { JWTPayload } from 'jose';

import { IPrincipal } from '../../../application/ports/principal.interface';
import { mapRoleNames } from '../shared/map-role-names';

/**
 * Maps a verified generic-OIDC access/ID token's claims onto the shared
 * `IPrincipal` shape. Unlike Cognito/Supabase, the role claim name isn't
 * standardized across OIDC providers, so it's configurable via
 * `OIDC_ROLE_CLAIM` (default `"roles"`).
 */
export function mapOidcClaimsToPrincipal(
  payload: JWTPayload,
  roleClaim: string,
): IPrincipal {
  const rawRoles = payload[roleClaim];
  const tenantId = payload.tenant_id;

  return {
    sub: String(payload.sub),
    email: typeof payload.email === 'string' ? payload.email : null,
    roles: mapRoleNames(
      Array.isArray(rawRoles) ? (rawRoles as string[]) : undefined,
    ),
    tenantId: typeof tenantId === 'string' ? tenantId : null,
  };
}
