import { JWTPayload } from 'jose';

import { IPrincipal } from '@core/identity/application/interfaces/principal.interface';
import { mapRoleNames } from '@core/identity/infrastructure/providers/shared/map-role-names';

interface ISupabaseAppMetadata {
  roles?: string[];
  tenant_ids?: string[];
}

/**
 * Maps a verified Supabase access token's claims onto the shared
 * `IPrincipal` shape. Roles and tenants come from `app_metadata`, the only
 * part of a Supabase JWT a client cannot self-modify.
 *
 * The claim is `tenant_ids` (plural, a native JSON array) rather than
 * Cognito's singular comma-separated `custom:tenant_id` string — Supabase's
 * `app_metadata` is real JSON, so a multi-tenant principal is represented
 * the natural way for this provider instead of needing a delimiter
 * convention.
 */
export function mapSupabaseClaimsToPrincipal(payload: JWTPayload): IPrincipal {
  const appMetadata = (payload.app_metadata ?? {}) as ISupabaseAppMetadata;

  return {
    sub: String(payload.sub),
    email: typeof payload.email === 'string' ? payload.email : null,
    roles: mapRoleNames(appMetadata.roles),
    tenantIds: appMetadata.tenant_ids ?? [],
  };
}
