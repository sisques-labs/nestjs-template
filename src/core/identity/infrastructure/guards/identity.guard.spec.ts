import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { IIdentityProvider } from '../../application/ports/identity-provider.port';
import { IPrincipal } from '../../application/interfaces/principal.interface';
import { ISessionRecord } from '../../application/interfaces/session-record.interface';
import { ISessionStore } from '../../application/ports/session-store.port';
import { getPrincipal, IdentityGuard } from './identity.guard';

interface FakeRequest {
  headers: Record<string, string>;
  cookies?: Record<string, string>;
}

function buildHttpContext(
  headers: Record<string, string> = {},
  cookies?: Record<string, string>,
): {
  context: ExecutionContext;
  request: FakeRequest;
} {
  const request: FakeRequest = { headers, cookies };
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

function buildIdentityProvider(): jest.Mocked<IIdentityProvider> {
  return {
    login: jest.fn(),
    refreshToken: jest.fn(),
    verifyToken: jest.fn(),
    createUser: jest.fn(),
    disableUser: jest.fn(),
    deleteUser: jest.fn(),
    updateUserAttributes: jest.fn(),
    resetPassword: jest.fn(),
    getAuthorizationUrl: jest.fn(),
    exchangeAuthorizationCode: jest.fn(),
  };
}

function buildSessionStore(): jest.Mocked<ISessionStore> {
  return {
    set: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  };
}

function buildConfigService(
  values: Record<string, string | number> = {},
): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

const PRINCIPAL: IPrincipal = {
  sub: 'user-123',
  email: 'user@example.com',
  roles: [],
  tenantIds: [],
};

describe('IdentityGuard', () => {
  describe('bearer-token path (no session store)', () => {
    it('rejects a request with no Authorization header', async () => {
      const { context } = buildHttpContext();
      const guard = new IdentityGuard(
        buildIdentityProvider(),
        undefined,
        buildConfigService(),
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a non-Bearer Authorization header', async () => {
      const { context } = buildHttpContext({ authorization: 'Basic abc123' });
      const guard = new IdentityGuard(
        buildIdentityProvider(),
        undefined,
        buildConfigService(),
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an empty Bearer token', async () => {
      const { context } = buildHttpContext({ authorization: 'Bearer   ' });
      const guard = new IdentityGuard(
        buildIdentityProvider(),
        undefined,
        buildConfigService(),
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('attaches the resolved principal to the request and allows the request', async () => {
      const { context, request } = buildHttpContext({
        authorization: 'Bearer valid-token',
      });
      const identityProvider = buildIdentityProvider();
      identityProvider.verifyToken.mockResolvedValue(PRINCIPAL);
      const guard = new IdentityGuard(
        identityProvider,
        undefined,
        buildConfigService(),
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(identityProvider.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(getPrincipal(request as never)).toEqual(PRINCIPAL);
    });

    it('propagates the provider rejection for an invalid token', async () => {
      const { context } = buildHttpContext({
        authorization: 'Bearer expired-token',
      });
      const identityProvider = buildIdentityProvider();
      identityProvider.verifyToken.mockRejectedValue(
        new UnauthorizedException('Invalid or expired access token'),
      );
      const guard = new IdentityGuard(
        identityProvider,
        undefined,
        buildConfigService(),
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('reads the request from the GraphQL context when the execution type is graphql', async () => {
      const request = { headers: { authorization: 'Bearer valid-token' } };
      // GqlExecutionContext.create() normalizes context.getArgs() into
      // [root, args, context, info] and reads the request off index 2.
      const context = {
        getType: () => 'graphql',
        getArgs: () => [undefined, undefined, { req: request }, undefined],
        getHandler: () => undefined,
        getClass: () => undefined,
      } as unknown as ExecutionContext;

      const identityProvider = buildIdentityProvider();
      identityProvider.verifyToken.mockResolvedValue({
        sub: 'user-123',
        email: null,
        roles: [],
        tenantIds: [],
      });
      const guard = new IdentityGuard(
        identityProvider,
        undefined,
        buildConfigService(),
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('falls back to the bearer path unchanged when the session store is present but no cookie is sent', async () => {
      const { context } = buildHttpContext({
        authorization: 'Bearer valid-token',
      });
      const identityProvider = buildIdentityProvider();
      identityProvider.verifyToken.mockResolvedValue(PRINCIPAL);
      const sessionStore = buildSessionStore();
      const guard = new IdentityGuard(
        identityProvider,
        sessionStore,
        buildConfigService(),
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(sessionStore.get).not.toHaveBeenCalled();
      expect(identityProvider.verifyToken).toHaveBeenCalledWith('valid-token');
    });
  });

  describe('session-cookie path', () => {
    function buildSessionRecord(
      overrides: Partial<ISessionRecord> = {},
    ): ISessionRecord {
      return {
        tokenSet: {
          accessToken: 'access',
          refreshToken: 'refresh',
          expiresIn: 3600,
        },
        principal: PRINCIPAL,
        expiresAt: Date.now() + 60_000,
        ...overrides,
      };
    }

    it('allows the request and attaches the principal without calling the provider', async () => {
      const { context, request } = buildHttpContext({}, { session: 'sid-1' });
      const identityProvider = buildIdentityProvider();
      const sessionStore = buildSessionStore();
      const record = buildSessionRecord();
      sessionStore.get.mockResolvedValue(record);
      const guard = new IdentityGuard(
        identityProvider,
        sessionStore,
        buildConfigService(),
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(sessionStore.get).toHaveBeenCalledWith('session:sid-1');
      expect(identityProvider.verifyToken).not.toHaveBeenCalled();
      expect(getPrincipal(request as never)).toEqual(PRINCIPAL);
    });

    it('takes precedence over a bearer header when both are present', async () => {
      const { context } = buildHttpContext(
        { authorization: 'Bearer some-other-token' },
        { session: 'sid-1' },
      );
      const identityProvider = buildIdentityProvider();
      const sessionStore = buildSessionStore();
      sessionStore.get.mockResolvedValue(buildSessionRecord());
      const guard = new IdentityGuard(
        identityProvider,
        sessionStore,
        buildConfigService(),
      );

      await guard.canActivate(context);

      expect(identityProvider.verifyToken).not.toHaveBeenCalled();
    });

    it('rejects with 401 when the cookie has no matching session record', async () => {
      const { context } = buildHttpContext({}, { session: 'sid-missing' });
      const identityProvider = buildIdentityProvider();
      const sessionStore = buildSessionStore();
      sessionStore.get.mockResolvedValue(null);
      const guard = new IdentityGuard(
        identityProvider,
        sessionStore,
        buildConfigService(),
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(identityProvider.verifyToken).not.toHaveBeenCalled();
    });

    it('uses the configured cookie name', async () => {
      const { context } = buildHttpContext({}, { my_session: 'sid-1' });
      const identityProvider = buildIdentityProvider();
      const sessionStore = buildSessionStore();
      sessionStore.get.mockResolvedValue(buildSessionRecord());
      const guard = new IdentityGuard(
        identityProvider,
        sessionStore,
        buildConfigService({ SESSION_COOKIE_NAME: 'my_session' }),
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(sessionStore.get).toHaveBeenCalledWith('session:sid-1');
    });

    describe('silent refresh', () => {
      it('refreshes an expired access token, updates the session, and attaches the principal', async () => {
        const { context, request } = buildHttpContext({}, { session: 'sid-1' });
        const identityProvider = buildIdentityProvider();
        const sessionStore = buildSessionStore();
        const record = buildSessionRecord({ expiresAt: Date.now() - 1000 });
        sessionStore.get.mockResolvedValue(record);
        identityProvider.refreshToken.mockResolvedValue({
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
          expiresIn: 3600,
        });
        const guard = new IdentityGuard(
          identityProvider,
          sessionStore,
          buildConfigService(),
        );

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(identityProvider.refreshToken).toHaveBeenCalledWith('refresh');
        expect(sessionStore.set).toHaveBeenCalledWith(
          'session:sid-1',
          expect.objectContaining({
            tokenSet: {
              accessToken: 'new-access',
              refreshToken: 'new-refresh',
              expiresIn: 3600,
            },
            principal: PRINCIPAL,
          }),
          86400,
        );
        expect(getPrincipal(request as never)).toEqual(PRINCIPAL);
      });

      it('destroys the session and rejects with 401 when refresh fails', async () => {
        const { context } = buildHttpContext({}, { session: 'sid-1' });
        const identityProvider = buildIdentityProvider();
        const sessionStore = buildSessionStore();
        const record = buildSessionRecord({ expiresAt: Date.now() - 1000 });
        sessionStore.get.mockResolvedValue(record);
        identityProvider.refreshToken.mockRejectedValue(new Error('revoked'));
        const guard = new IdentityGuard(
          identityProvider,
          sessionStore,
          buildConfigService(),
        );

        await expect(guard.canActivate(context)).rejects.toThrow(
          UnauthorizedException,
        );
        expect(sessionStore.delete).toHaveBeenCalledWith('session:sid-1');
        expect(sessionStore.set).not.toHaveBeenCalled();
      });

      it('destroys the session and rejects with 401 when there is no refresh token to use', async () => {
        const { context } = buildHttpContext({}, { session: 'sid-1' });
        const identityProvider = buildIdentityProvider();
        const sessionStore = buildSessionStore();
        const record = buildSessionRecord({
          expiresAt: Date.now() - 1000,
          tokenSet: {
            accessToken: 'access',
            refreshToken: null,
            expiresIn: 3600,
          },
        });
        sessionStore.get.mockResolvedValue(record);
        const guard = new IdentityGuard(
          identityProvider,
          sessionStore,
          buildConfigService(),
        );

        await expect(guard.canActivate(context)).rejects.toThrow(
          UnauthorizedException,
        );
        expect(identityProvider.refreshToken).not.toHaveBeenCalled();
        expect(sessionStore.delete).toHaveBeenCalledWith('session:sid-1');
      });
    });
  });
});
