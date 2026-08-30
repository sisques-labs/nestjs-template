import { JWTPayload } from 'jose';

import { IPrincipal } from '@core/identity/application/interfaces/principal.interface';
import { mapRoleNames } from '@core/identity/infrastructure/providers/shared/map-role-names';

/**
 * Maps a verified generic-OIDC access/ID token's claims onto the shared
 * `IPrincipal` shape. Unlike Cognito/Supabase, the role claim name isn't
 * standardized across OIDC providers, so it's configurable via
 * `OIDC_ROLE_CLAIM` (default `"roles"`).
 *
 * `tenant_ids` is accepted as either a native JSON array (most OIDC
 * providers support arbitrary JSON in custom claims) or a comma-separated
 * string (defensive fallback, since not every provider's custom-claim
 * tooling supports arrays cleanly) — both are normalized to `string[]`.
 */
export function mapOidcClaimsToPrincipal(
  payload: JWTPayload,
  roleClaim: string,
): IPrincipal {
  const rawRoles = payload[roleClaim];
  const tenantIdsClaim = payload.tenant_ids;

  return {
    sub: String(payload.sub),
    email: typeof payload.email === 'string' ? payload.email : null,
    roles: mapRoleNames(
      Array.isArray(rawRoles) ? (rawRoles as string[]) : undefined,
    ),
    tenantIds: normalizeTenantIds(tenantIdsClaim),
  };
}

function normalizeTenantIds(tenantIdsClaim: unknown): string[] {
  if (Array.isArray(tenantIdsClaim)) {
    return tenantIdsClaim.filter(
      (value): value is string => typeof value === 'string',
    );
  }

  if (typeof tenantIdsClaim === 'string') {
    return tenantIdsClaim
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  return [];
}
