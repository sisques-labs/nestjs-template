import { JWTPayload } from 'jose';

import { Role } from '@core/identity/domain/enums/role.enum';
import { mapCognitoClaimsToPrincipal } from './cognito-claims.mapper';

describe('mapCognitoClaimsToPrincipal', () => {
  it('maps sub, email, groups, and a single-value tenant claim', () => {
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
      tenantIds: ['tenant-1'],
    });
  });

  it('splits a comma-separated tenant claim into multiple tenant ids', () => {
    const payload: JWTPayload = {
      sub: 'user-123',
      'custom:tenant_id': 'tenant-1, tenant-2,tenant-3',
    };

    expect(mapCognitoClaimsToPrincipal(payload).tenantIds).toEqual([
      'tenant-1',
      'tenant-2',
      'tenant-3',
    ]);
  });

  it('drops empty entries produced by stray commas', () => {
    const payload: JWTPayload = {
      sub: 'user-123',
      'custom:tenant_id': 'tenant-1,,tenant-2,',
    };

    expect(mapCognitoClaimsToPrincipal(payload).tenantIds).toEqual([
      'tenant-1',
      'tenant-2',
    ]);
  });

  it('defaults email, roles, and tenantIds when claims are absent', () => {
    const payload: JWTPayload = { sub: 'user-123' };

    expect(mapCognitoClaimsToPrincipal(payload)).toEqual({
      sub: 'user-123',
      email: null,
      roles: [],
      tenantIds: [],
    });
  });
});
