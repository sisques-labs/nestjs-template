import { Role } from '../../domain/enums/role.enum';

/**
 * Provider-agnostic identity of the caller, resolved from a verified access
 * token. Every `IIdentityProvider` adapter maps its own raw claim shape onto
 * this interface — nothing downstream (guards, resolvers, MCP tools) ever
 * sees a provider-specific claim.
 */
export interface IPrincipal {
  sub: string;
  email: string | null;
  roles: Role[];
  tenantId: string | null;
}
