import { JWTPayload } from 'jose';

import { Role } from '../../../domain/enums/role.enum';
import { mapCognitoClaimsToPrincipal } from './cognito-claims.mapper';

describe('mapCognitoClaimsToPrincipal', () => {
  it('maps sub, email, groups, and tenant claims', () => {
    const payload: JWTPayload = {
      sub: 'user-123',
      email: 'user@example.com',
      'cognito:groups': ['admin', 'user'],
      'custom:tenant_id': 'tenant-1',
    };

    expect(mapCognitoClaimsToPrincipal(payload)).toEqual({
      sub: 'user-123',
      email: 'user@example.com',
      roles: [Role.ADMIN, Role.USER],
      tenantId: 'tenant-1',
    });
  });

  it('defaults email, roles, and tenantId when claims are absent', () => {
    const payload: JWTPayload = { sub: 'user-123' };

    expect(mapCognitoClaimsToPrincipal(payload)).toEqual({
      sub: 'user-123',
      email: null,
      roles: [],
      tenantId: null,
    });
  });
});
