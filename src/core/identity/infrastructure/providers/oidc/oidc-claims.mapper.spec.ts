import { JWTPayload } from 'jose';

import { Role } from '../../../domain/enums/role.enum';
import { mapOidcClaimsToPrincipal } from './oidc-claims.mapper';

describe('mapOidcClaimsToPrincipal', () => {
  it('maps sub, email, roles (from the configured claim), and a JSON array tenant claim', () => {
    const payload: JWTPayload = {
      sub: 'user-123',
      email: 'user@example.com',
      roles: ['admin'],
      tenant_ids: ['tenant-1', 'tenant-2'],
    };

    expect(mapOidcClaimsToPrincipal(payload, 'roles')).toEqual({
      sub: 'user-123',
      email: 'user@example.com',
      roles: [Role.ADMIN],
      tenantIds: ['tenant-1', 'tenant-2'],
    });
  });

  it('accepts a comma-separated string tenant claim as a defensive fallback', () => {
    const payload: JWTPayload = {
      sub: 'user-123',
      tenant_ids: 'tenant-1, tenant-2',
    };

    expect(mapOidcClaimsToPrincipal(payload, 'roles').tenantIds).toEqual([
      'tenant-1',
      'tenant-2',
    ]);
  });

  it('reads roles from a custom-configured claim name', () => {
    const payload: JWTPayload = {
      sub: 'user-123',
      'https://example.com/roles': ['user'],
    };

    expect(
      mapOidcClaimsToPrincipal(payload, 'https://example.com/roles'),
    ).toEqual({
      sub: 'user-123',
      email: null,
      roles: [Role.USER],
      tenantIds: [],
    });
  });

  it('defaults email, roles, and tenantIds when claims are absent', () => {
    const payload: JWTPayload = { sub: 'user-123' };

    expect(mapOidcClaimsToPrincipal(payload, 'roles')).toEqual({
      sub: 'user-123',
      email: null,
      roles: [],
      tenantIds: [],
    });
  });
});
