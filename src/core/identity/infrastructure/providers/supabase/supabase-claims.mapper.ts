import { JWTPayload } from 'jose';

import { IPrincipal } from '../../../application/ports/principal.interface';
import { mapRoleNames } from '../shared/map-role-names';

interface ISupabaseAppMetadata {
  roles?: string[];
  tenant_id?: string;
}

/**
 * Maps a verified Supabase access token's claims onto the shared
 * `IPrincipal` shape. Roles and tenant come from `app_metadata`, the only
 * part of a Supabase JWT a client cannot self-modify.
 */
export function mapSupabaseClaimsToPrincipal(payload: JWTPayload): IPrincipal {
  const appMetadata = (payload.app_metadata ?? {}) as ISupabaseAppMetadata;

  return {
    sub: String(payload.sub),
    email: typeof payload.email === 'string' ? payload.email : null,
    roles: mapRoleNames(appMetadata.roles),
    tenantId: appMetadata.tenant_id ?? null,
  };
}
