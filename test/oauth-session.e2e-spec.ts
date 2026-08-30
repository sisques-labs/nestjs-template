import { Controller, Get, UseGuards } from '@nestjs/common';
import type { DataSource } from 'typeorm';

import {
  IDENTITY_PROVIDER,
  IIdentityProvider,
} from '@core/identity/application/ports/identity-provider.port';
import { IAuthorizationUrlOptions } from '@core/identity/application/interfaces/authorization-url-options.interface';
import { IPrincipal } from '@core/identity/application/interfaces/principal.interface';
import { ISessionRecord } from '@core/identity/application/interfaces/session-record.interface';
import {
  ISessionStore,
  SESSION_STORE,
} from '@core/identity/application/ports/session-store.port';
import { CurrentUser } from '@core/identity/infrastructure/decorators/current-user.decorator';
import { IdentityGuard } from '@core/identity/infrastructure/guards/identity.guard';
import { REDIS_CLIENT } from '@core/identity/infrastructure/session/redis-session.store';
import type { E2EContext } from './helpers/app-bootstrap';

/**
 * Ad-hoc route exercising IdentityGuard's session-cookie/bearer resolution
 * — this template has no bounded contexts yet, so there's no real protected
 * route to test against. Mirrors `identity.e2e-spec.ts`'s
 * `ProtectedTestController`, which is not exported from that file.
 */
@Controller('test-protected')
class ProtectedTestController {
  @Get('whoami')
  @UseGuards(IdentityGuard)
  whoami(@CurrentUser() user: IPrincipal | undefined): IPrincipal | undefined {
    return user;
  }
}

/**
 * Minimal in-memory stand-in for `ISessionStore`, faithfully respecting TTL
 * expiry. Overrides the real `SESSION_STORE` (`RedisSessionStore`) so this
 * suite never opens a real Redis connection — see the class-level comment
 * on why `REDIS_CLIENT` is also overridden. Exposes nothing beyond the
 * `ISessionStore` contract except direct `set`/`get` access, used by the
 * silent-refresh tests to seed an already-expired session without driving
 * the full start -> callback flow.
 */
class FakeSessionStore implements ISessionStore {
  private readonly entries = new Map<
    string,
    { value: unknown; expiresAt: number }
  >();

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
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

/** Extracts a single `name=value` Set-Cookie pair for use as a `Cookie` request header. */
function extractCookie(
  res: { headers: Record<string, unknown> },
  name: string,
): string {
  const raw = res.headers['set-cookie'];
  const cookies: string[] = Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === 'string'
      ? [raw]
      : [];
  const found = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!found) {
    throw new Error(`Cookie "${name}" not found in Set-Cookie header`);
  }
  return found.split(';')[0];
}

/** Reads the `state` the controller most recently sent to `getAuthorizationUrl()`. */
function latestOAuthState(
  identityProvider: jest.Mocked<IIdentityProvider>,
): string {
  const calls = identityProvider.getAuthorizationUrl.mock.calls;
  const lastCall = calls[calls.length - 1] as [IAuthorizationUrlOptions];
  return lastCall[0].state;
}

const SUCCESS_REDIRECT_URL = 'http://localhost/dashboard';

describe('OAuth session login (e2e)', () => {
  let ctx: E2EContext;
  let dataSource: DataSource;
  let identityProvider: jest.Mocked<IIdentityProvider>;
  let sessionStore: FakeSessionStore;

  beforeAll(async () => {
    // IDENTITY_PROVIDER / OAUTH_SESSION_ENABLED must be set before AppModule
    // (and identity.module.ts, which reads OAUTH_SESSION_ENABLED at
    // module-load time) is required — hence the dynamic import here rather
    // than a static one at the top of this file. Cleaned up in afterAll:
    // maxWorkers: 1 for e2e specs means leaked env vars would bleed into
    // whichever spec file runs next.
    process.env.IDENTITY_PROVIDER = 'oidc';
    process.env.OIDC_ISSUER_URL = 'https://idp.example.com';
    process.env.OIDC_CLIENT_ID = 'test-client';
    process.env.OIDC_CLIENT_SECRET = 'test-secret';
    process.env.OAUTH_SESSION_ENABLED = 'true';
    process.env.SESSION_REDIS_URL = 'redis://unused:6379';
    process.env.SESSION_COOKIE_NAME = 'session';
    process.env.SESSION_TTL_SECONDS = '3600';
    process.env.OAUTH_REDIRECT_URI = 'http://localhost/api/auth/oauth/callback';
    process.env.OAUTH_SUCCESS_REDIRECT_URL = SUCCESS_REDIRECT_URL;

    const { createE2EApp } = await import('./helpers/app-bootstrap');

    identityProvider = buildIdentityProvider();
    sessionStore = new FakeSessionStore();

    ctx = await createE2EApp({
      controllers: [ProtectedTestController],
      overrideProviders: [
        { token: IDENTITY_PROVIDER, useValue: identityProvider },
        // Never actually dialed: SESSION_STORE below fully replaces
        // RedisSessionStore, so the class that would use this client is
        // never instantiated. Overridden anyway so the real REDIS_CLIENT
        // factory (`new Redis(...)`) — eagerly instantiated by Nest during
        // module compilation regardless of whether anything currently
        // injects it — never attempts a real TCP connection.
        { token: REDIS_CLIENT, useValue: {} },
        { token: SESSION_STORE, useValue: sessionStore },
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
    delete process.env.OAUTH_SESSION_ENABLED;
    delete process.env.SESSION_REDIS_URL;
    delete process.env.SESSION_COOKIE_NAME;
    delete process.env.SESSION_TTL_SECONDS;
    delete process.env.OAUTH_REDIRECT_URI;
    delete process.env.OAUTH_SUCCESS_REDIRECT_URL;
  });

  beforeEach(async () => {
    const { truncateAll } = await import('./helpers/db-reset');
    await truncateAll(dataSource);
    jest.clearAllMocks();
    sessionStore.clear();
  });

  const SESSION_PRINCIPAL: IPrincipal = {
    sub: 'user-session',
    email: 'session@example.com',
    roles: [],
    tenantIds: [],
  };
  const BEARER_PRINCIPAL: IPrincipal = {
    sub: 'user-bearer',
    email: 'bearer@example.com',
    roles: [],
    tenantIds: [],
  };

  /** Drives a full start -> callback flow and returns the resulting session `Cookie` pair. */
  async function loginAndGetSessionCookie(options: {
    accessToken: string;
    refreshToken: string | null;
    principal: IPrincipal;
  }): Promise<string> {
    identityProvider.getAuthorizationUrl.mockResolvedValue(
      'https://idp.example.com/oauth2/authorize',
    );

    const startRes = await ctx.http().get('/api/auth/oauth/start');
    const nonceCookie = extractCookie(startRes, 'oauth_nonce');
    const state = latestOAuthState(identityProvider);

    identityProvider.exchangeAuthorizationCode.mockResolvedValue({
      accessToken: options.accessToken,
      refreshToken: options.refreshToken,
      expiresIn: 3600,
    });
    identityProvider.verifyToken.mockResolvedValue(options.principal);

    const callbackRes = await ctx
      .http()
      .get('/api/auth/oauth/callback')
      .query({ code: 'auth-code', state })
      .set('Cookie', nonceCookie);

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe(SUCCESS_REDIRECT_URL);

    return extractCookie(callbackRes, 'session');
  }

  describe('GET /api/auth/oauth/start', () => {
    it('redirects to the provider authorization URL and sets an oauth_nonce cookie', async () => {
      const authorizationUrl = 'https://idp.example.com/oauth2/authorize?x=1';
      identityProvider.getAuthorizationUrl.mockResolvedValue(authorizationUrl);

      const res = await ctx.http().get('/api/auth/oauth/start');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(authorizationUrl);
      const nonceCookie = extractCookie(res, 'oauth_nonce');
      expect(nonceCookie).toMatch(/^oauth_nonce=.+/);
      expect(identityProvider.getAuthorizationUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectUri: 'http://localhost/api/auth/oauth/callback',
          state: expect.any(String),
          codeChallenge: expect.any(String),
        }),
      );
    });
  });

  describe('GET /api/auth/oauth/callback', () => {
    it('creates a session, sets the session cookie, and redirects to the success URL', async () => {
      const sessionCookie = await loginAndGetSessionCookie({
        accessToken: 'session-access-token',
        refreshToken: 'session-refresh-token',
        principal: SESSION_PRINCIPAL,
      });
      expect(sessionCookie).toMatch(/^session=.+/);

      const whoamiRes = await ctx
        .http()
        .get('/api/test-protected/whoami')
        .set('Cookie', sessionCookie);

      expect(whoamiRes.status).toBe(200);
      expect(whoamiRes.body).toEqual(SESSION_PRINCIPAL);
    });

    it('rejects with 401 and sets no session cookie when the state does not match', async () => {
      identityProvider.getAuthorizationUrl.mockResolvedValue(
        'https://idp.example.com/oauth2/authorize',
      );
      const startRes = await ctx.http().get('/api/auth/oauth/start');
      const nonceCookie = extractCookie(startRes, 'oauth_nonce');

      const callbackRes = await ctx
        .http()
        .get('/api/auth/oauth/callback')
        .query({ code: 'auth-code', state: 'not-the-real-state' })
        .set('Cookie', nonceCookie);

      expect(callbackRes.status).toBe(401);
      expect(callbackRes.headers['set-cookie']).toBeUndefined();
      expect(identityProvider.exchangeAuthorizationCode).not.toHaveBeenCalled();
    });

    it('rejects with 401 and sets no session cookie when there is no nonce cookie at all', async () => {
      const callbackRes = await ctx
        .http()
        .get('/api/auth/oauth/callback')
        .query({ code: 'auth-code', state: 'irrelevant' });

      expect(callbackRes.status).toBe(401);
      expect(callbackRes.headers['set-cookie']).toBeUndefined();
      expect(identityProvider.exchangeAuthorizationCode).not.toHaveBeenCalled();
    });
  });

  describe('session cookie authentication', () => {
    it('authenticates a subsequent request with no Authorization header at all', async () => {
      const sessionCookie = await loginAndGetSessionCookie({
        accessToken: 'session-access-token',
        refreshToken: 'session-refresh-token',
        principal: SESSION_PRINCIPAL,
      });

      const res = await ctx
        .http()
        .get('/api/test-protected/whoami')
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(SESSION_PRINCIPAL);
    });

    it('takes precedence over a bearer header when both are present', async () => {
      const sessionCookie = await loginAndGetSessionCookie({
        accessToken: 'session-access-token',
        refreshToken: 'session-refresh-token',
        principal: SESSION_PRINCIPAL,
      });

      // Distinguishable from SESSION_PRINCIPAL so the test can tell which
      // resolution path actually won.
      identityProvider.verifyToken.mockClear();
      identityProvider.verifyToken.mockResolvedValue(BEARER_PRINCIPAL);

      const res = await ctx
        .http()
        .get('/api/test-protected/whoami')
        .set('Cookie', sessionCookie)
        .set('Authorization', 'Bearer bearer-access-token');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(SESSION_PRINCIPAL);
      // Proves the bearer path never ran, not merely that its result lost.
      expect(identityProvider.verifyToken).not.toHaveBeenCalled();
    });
  });

  describe('silent token refresh', () => {
    async function seedExpiredSession(options: {
      sessionId: string;
      refreshToken: string;
      principal: IPrincipal;
    }): Promise<void> {
      const record: ISessionRecord = {
        tokenSet: {
          accessToken: 'stale-access-token',
          refreshToken: options.refreshToken,
          expiresIn: 3600,
        },
        principal: options.principal,
        expiresAt: Date.now() - 1000,
      };
      await sessionStore.set(`session:${options.sessionId}`, record, 3600);
    }

    it('silently refreshes an expired access token and keeps the principal', async () => {
      await seedExpiredSession({
        sessionId: 'expired-session',
        refreshToken: 'old-refresh-token',
        principal: SESSION_PRINCIPAL,
      });
      identityProvider.refreshToken.mockResolvedValue({
        accessToken: 'fresh-access-token',
        refreshToken: 'fresh-refresh-token',
        expiresIn: 3600,
      });

      const res = await ctx
        .http()
        .get('/api/test-protected/whoami')
        .set('Cookie', 'session=expired-session');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(SESSION_PRINCIPAL);
      expect(identityProvider.refreshToken).toHaveBeenCalledWith(
        'old-refresh-token',
      );
    });

    it('destroys the session and returns 401 when the refresh fails, staying dead on a retry', async () => {
      await seedExpiredSession({
        sessionId: 'doomed-session',
        refreshToken: 'revoked-refresh-token',
        principal: SESSION_PRINCIPAL,
      });
      identityProvider.refreshToken.mockRejectedValue(
        new Error('refresh token revoked'),
      );

      const firstRes = await ctx
        .http()
        .get('/api/test-protected/whoami')
        .set('Cookie', 'session=doomed-session');
      expect(firstRes.status).toBe(401);

      const secondRes = await ctx
        .http()
        .get('/api/test-protected/whoami')
        .set('Cookie', 'session=doomed-session');
      expect(secondRes.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears the session cookie and invalidates the session', async () => {
      const sessionCookie = await loginAndGetSessionCookie({
        accessToken: 'session-access-token',
        refreshToken: 'session-refresh-token',
        principal: SESSION_PRINCIPAL,
      });

      const logoutRes = await ctx
        .http()
        .post('/api/auth/logout')
        .set('Cookie', sessionCookie);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body).toEqual({ success: true });
      const clearedCookie = extractCookie(logoutRes, 'session');
      expect(clearedCookie).toBe('session=');

      const staleRes = await ctx
        .http()
        .get('/api/test-protected/whoami')
        .set('Cookie', sessionCookie);
      expect(staleRes.status).toBe(401);
    });

    it('succeeds idempotently with no session cookie at all', async () => {
      const res = await ctx.http().post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });
  });

  describe('POST /api/auth/login (bearer, unaffected by OAUTH_SESSION_ENABLED)', () => {
    it('still returns a token set unchanged', async () => {
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
      expect(res.headers['set-cookie']).toBeUndefined();
    });
  });
});
