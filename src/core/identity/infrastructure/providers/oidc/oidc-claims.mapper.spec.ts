import { JWTPayload } from 'jose';

import { Role } from '../../../domain/enums/role.enum';
import { mapOidcClaimsToPrincipal } from './oidc-claims.mapper';

describe('mapOidcClaimsToPrincipal', () => {
  it('maps sub, email, roles (from the configured claim), and tenant', () => {
    const payload: JWTPayload = {
      sub: 'user-123',
      email: 'user@example.com',
      roles: ['admin'],
      tenant_id: 'tenant-1',
    };

    expect(mapOidcClaimsToPrincipal(payload, 'roles')).toEqual({
      sub: 'user-123',
      email: 'user@example.com',
      roles: [Role.ADMIN],
      tenantId: 'tenant-1',
    });
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
      tenantId: null,
    });
  });

  it('defaults email, roles, and tenantId when claims are absent', () => {
    const payload: JWTPayload = { sub: 'user-123' };

    expect(mapOidcClaimsToPrincipal(payload, 'roles')).toEqual({
      sub: 'user-123',
      email: null,
      roles: [],
      tenantId: null,
    });
  });
});
