import { RoleEnum } from '@core/identity/domain/enums/role.enum';

/**
 * Provider-agnostic identity of the caller, resolved from a verified access
 * token. Every `IIdentityProvider` adapter maps its own raw claim shape onto
 * this interface — nothing downstream (guards, resolvers, MCP tools) ever
 * sees a provider-specific claim.
 *
 * `tenantIds` is every tenant this principal is a verified member of, per
 * the IdP's claims (a principal can legitimately belong to more than one
 * tenant). An empty array means no tenant membership. This is a list of
 * *external* tenant ids straight off the token — `TenantGuard` is what
 * picks one (via the `X-Tenant-Id` header, or the sole entry when there's
 * only one) and resolves it to an internal `Tenant` id for a given request.
 */
export interface IPrincipal {
  sub: string;
  email: string | null;
  roles: RoleEnum[];
  tenantIds: string[];
}
