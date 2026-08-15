import { JWTPayload } from 'jose';

import { Role } from '../../../domain/enums/role.enum';
import { mapSupabaseClaimsToPrincipal } from './supabase-claims.mapper';

describe('mapSupabaseClaimsToPrincipal', () => {
  it('maps sub, email, roles, and tenant from app_metadata', () => {
    const payload: JWTPayload = {
      sub: 'user-123',
      email: 'user@example.com',
      app_metadata: { roles: ['admin'], tenant_id: 'tenant-1' },
    };

    expect(mapSupabaseClaimsToPrincipal(payload)).toEqual({
      sub: 'user-123',
      email: 'user@example.com',
      roles: [Role.ADMIN],
      tenantId: 'tenant-1',
    });
  });

  it('defaults email, roles, and tenantId when app_metadata is absent', () => {
    const payload: JWTPayload = { sub: 'user-123' };

    expect(mapSupabaseClaimsToPrincipal(payload)).toEqual({
      sub: 'user-123',
      email: null,
      roles: [],
      tenantId: null,
    });
  });
});
