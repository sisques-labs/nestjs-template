import {
  Controller,
  Get,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { DataSource } from 'typeorm';

import {
  IDENTITY_PROVIDER,
  IIdentityProvider,
} from '../src/core/identity/application/ports/identity-provider.port';
import { IPrincipal } from '../src/core/identity/application/ports/interfaces/principal.interface';
import { Role } from '../src/core/identity/domain/enums/role.enum';
import { CurrentUser } from '../src/core/identity/infrastructure/decorators/current-user.decorator';
import { Roles } from '../src/core/identity/infrastructure/decorators/roles.decorator';
import { IdentityGuard } from '../src/core/identity/infrastructure/guards/identity.guard';
import { RolesGuard } from '../src/core/identity/infrastructure/guards/roles.guard';
import type { E2EContext } from './helpers/app-bootstrap';

const VALID_TOKEN = 'valid-token';
const ADMIN_PRINCIPAL: IPrincipal = {
  sub: 'user-1',
  email: 'admin@example.com',
  roles: [Role.ADMIN],
  tenantIds: [],
};

/**
 * Ad-hoc route exercising IdentityGuard/RolesGuard/@CurrentUser() — this
 * template has no bounded contexts yet, so there's no real protected route
 * to test against.
 */
@Controller('test-protected')
class ProtectedTestController {
  @Get('whoami')
  @UseGuards(IdentityGuard)
  whoami(@CurrentUser() user: IPrincipal | undefined): IPrincipal | undefined {
    return user;
  }

  @Get('admin-only')
  @UseGuards(IdentityGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminOnly(
    @CurrentUser() user: IPrincipal | undefined,
  ): IPrincipal | undefined {
    return user;
  }
}

function buildIdentityProvider(): jest.Mocked<IIdentityProvider> {
  return {
    login: jest.fn(),
    refreshToken: jest.fn(),
    verifyToken: jest.fn(),
    getAuthorizationUrl: jest.fn(),
    exchangeAuthorizationCode: jest.fn(),
    createUser: jest.fn(),
    disableUser: jest.fn(),
    deleteUser: jest.fn(),
    updateUserAttributes: jest.fn(),
    resetPassword: jest.fn(),
  };
}

describe('Identity (e2e)', () => {
  let ctx: E2EContext;
  let dataSource: DataSource;
  let identityProvider: jest.Mocked<IIdentityProvider>;

  beforeAll(async () => {
    // IDENTITY_PROVIDER must be set before AppModule (and core.module.ts,
    // which reads it at module-load time) is required — hence the dynamic
    // import here rather than a static one at the top of this file.
    process.env.IDENTITY_PROVIDER = 'oidc';
    process.env.OIDC_ISSUER_URL = 'https://idp.example.com';
    process.env.OIDC_CLIENT_ID = 'test-client';
    process.env.OIDC_CLIENT_SECRET = 'test-secret';

    const { createE2EApp } = await import('./helpers/app-bootstrap');

    identityProvider = buildIdentityProvider();

    ctx = await createE2EApp({
      controllers: [ProtectedTestController],
      overrideProviders: [
        { token: IDENTITY_PROVIDER, useValue: identityProvider },
      ],
    });
    dataSource = ctx.dataSource;
  });

  afterAll(async () => {
    await ctx.close();
    delete process.env.IDENTITY_PROVIDER;
    delete process.env.OIDC_ISSUER_URL;
    delete process.env.OIDC_CLIENT_ID;
    delete process.env.OIDC_CLIENT_SECRET;
  });

  beforeEach(async () => {
    const { truncateAll } = await import('./helpers/db-reset');
    await truncateAll(dataSource);
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('returns a token set on valid credentials', async () => {
      identityProvider.login.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 3600,
      });

      const res = await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'secret' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 3600,
      });
      expect(identityProvider.login).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'secret',
      });
    });

    it('rejects an invalid payload with 400', async () => {
      const res = await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: '' });

      expect(res.status).toBe(400);
      expect(identityProvider.login).not.toHaveBeenCalled();
    });

    it('surfaces the provider rejection for invalid credentials as 401', async () => {
      identityProvider.login.mockRejectedValue(
        new UnauthorizedException('Invalid login credentials'),
      );

      const res = await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'wrong' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns a new token set', async () => {
      identityProvider.refreshToken.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresIn: 3600,
      });

      const res = await ctx
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken: 'old-refresh' });

      expect(res.status).toBe(200);
      expect(identityProvider.refreshToken).toHaveBeenCalledWith('old-refresh');
    });
  });

  describe('IdentityGuard / RolesGuard on a protected route', () => {
    it('rejects a request with no Authorization header', async () => {
      const res = await ctx.http().get('/api/test-protected/whoami');

      expect(res.status).toBe(401);
    });

    it('returns the principal for a valid token', async () => {
      identityProvider.verifyToken.mockResolvedValue(ADMIN_PRINCIPAL);

      const res = await ctx
        .http()
        .get('/api/test-protected/whoami')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(ADMIN_PRINCIPAL);
    });

    it('allows an admin-only route for a principal with the admin role', async () => {
      identityProvider.verifyToken.mockResolvedValue(ADMIN_PRINCIPAL);

      const res = await ctx
        .http()
        .get('/api/test-protected/admin-only')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(200);
    });

    it('rejects an admin-only route for a principal without the admin role', async () => {
      identityProvider.verifyToken.mockResolvedValue({
        ...ADMIN_PRINCIPAL,
        roles: [Role.USER],
      });

      const res = await ctx
        .http()
        .get('/api/test-protected/admin-only')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(403);
    });
  });
});
