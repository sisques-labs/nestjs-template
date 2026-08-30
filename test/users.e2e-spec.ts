import { DataSource } from 'typeorm';

import {
  IDENTITY_PROVIDER,
  IIdentityProvider,
} from '../src/core/identity/application/ports/identity-provider.port';
import { IPrincipal } from '../src/core/identity/application/ports/interfaces/principal.interface';
import { Role } from '../src/core/identity/domain/enums/role.enum';
import type { E2EContext } from './helpers/app-bootstrap';

const VALID_TOKEN = 'valid-token';

function principal(overrides: Partial<IPrincipal> = {}): IPrincipal {
  return {
    sub: 'sub-1',
    email: 'alice@example.com',
    roles: [Role.USER],
    tenantIds: ['ext-tenant-1'],
    ...overrides,
  };
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

/**
 * Unlike `identity.e2e-spec.ts`/`tenancy.e2e-spec.ts`, this file exercises
 * a **real** bounded-context controller (`UsersController`, registered by
 * `AppModule` itself once `IDENTITY_PROVIDER`/`TENANCY_ENABLED` are set) —
 * no ad-hoc test controller needed, since `users` is this template's first
 * context with a real production REST surface.
 */
describe('Users (e2e)', () => {
  describe('/users/me with both flags enabled', () => {
    let ctx: E2EContext;
    let dataSource: DataSource;
    let identityProvider: jest.Mocked<IIdentityProvider>;

    beforeAll(async () => {
      // Must be set before AppModule (and core.module.ts /
      // users.module.ts, both of which read these at module-*load* time)
      // is required — hence the dynamic import below rather than a static
      // one at the top of this file. See the identical comment in
      // identity.e2e-spec.ts / tenancy.e2e-spec.ts.
      process.env.IDENTITY_PROVIDER = 'oidc';
      process.env.OIDC_ISSUER_URL = 'https://idp.example.com';
      process.env.OIDC_CLIENT_ID = 'test-client';
      process.env.OIDC_CLIENT_SECRET = 'test-secret';
      process.env.TENANCY_ENABLED = 'true';

      const { createE2EApp } = await import('./helpers/app-bootstrap');

      identityProvider = buildIdentityProvider();

      ctx = await createE2EApp({
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
      delete process.env.TENANCY_ENABLED;
    });

    beforeEach(async () => {
      const { truncateAll } = await import('./helpers/db-reset');
      await truncateAll(dataSource);
      jest.clearAllMocks();
    });

    describe('GET /users/me', () => {
      it('rejects a request with no Authorization header', async () => {
        const res = await ctx.http().get('/api/users/me');

        expect(res.status).toBe(401);
      });

      it('creates the user on first request, defaulting displayName from the email claim', async () => {
        identityProvider.verifyToken.mockResolvedValue(principal());

        const res = await ctx
          .http()
          .get('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`);

        expect(res.status).toBe(200);
        expect(res.body.email).toBe('alice@example.com');
        expect(res.body.displayName).toBe('alice');
        expect(res.body.avatarUrl).toBeNull();
        expect(res.body.locale).toBeNull();
        expect(res.body.timezone).toBeNull();
        expect(res.body.externalId).toBeUndefined();

        const rows = await dataSource.query<
          { external_id: string; display_name: string }[]
        >(
          'SELECT external_id, display_name FROM users WHERE external_id = $1',
          ['sub-1'],
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].display_name).toBe('alice');
      });

      it('is idempotent on a second request, not creating a duplicate row', async () => {
        identityProvider.verifyToken.mockResolvedValue(principal());

        const first = await ctx
          .http()
          .get('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`);
        const second = await ctx
          .http()
          .get('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`);

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(second.body.id).toBe(first.body.id);

        const rows = await dataSource.query<{ count: string }[]>(
          'SELECT COUNT(*) AS count FROM users WHERE external_id = $1',
          ['sub-1'],
        );
        expect(rows[0].count).toBe('1');
      });

      it('scopes users per tenant — the same sub in two different tenants produces two independent rows', async () => {
        identityProvider.verifyToken.mockResolvedValueOnce(
          principal({ tenantIds: ['ext-tenant-1'] }),
        );
        const first = await ctx
          .http()
          .get('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`);

        identityProvider.verifyToken.mockResolvedValueOnce(
          principal({ tenantIds: ['ext-tenant-2'] }),
        );
        const second = await ctx
          .http()
          .get('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`);

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(first.body.id).not.toBe(second.body.id);
        expect(first.body.tenantId).not.toBe(second.body.tenantId);

        const rows = await dataSource.query<{ count: string }[]>(
          'SELECT COUNT(*) AS count FROM users WHERE external_id = $1',
          ['sub-1'],
        );
        expect(rows[0].count).toBe('2');
      });
    });

    describe('PATCH /users/me', () => {
      it('creates the user on first PATCH, applying the requested displayName (not the default)', async () => {
        identityProvider.verifyToken.mockResolvedValue(principal());

        const res = await ctx
          .http()
          .patch('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`)
          .send({ displayName: 'Alicia' });

        expect(res.status).toBe(200);
        expect(res.body.displayName).toBe('Alicia');

        const rows = await dataSource.query<{ count: string }[]>(
          'SELECT COUNT(*) AS count FROM users WHERE external_id = $1',
          ['sub-1'],
        );
        expect(rows[0].count).toBe('1');
      });

      it('updates displayName on an existing user', async () => {
        identityProvider.verifyToken.mockResolvedValue(principal());
        await ctx
          .http()
          .get('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`);

        const res = await ctx
          .http()
          .patch('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`)
          .send({ displayName: 'Alicia' });

        expect(res.status).toBe(200);
        expect(res.body.displayName).toBe('Alicia');
        expect(res.body.email).toBe('alice@example.com');
      });

      it('rejects a blank displayName with 400', async () => {
        identityProvider.verifyToken.mockResolvedValue(principal());

        const res = await ctx
          .http()
          .patch('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`)
          .send({ displayName: '' });

        expect(res.status).toBe(400);
      });

      it('rejects a request body attempting to set email, via the global whitelist ValidationPipe', async () => {
        identityProvider.verifyToken.mockResolvedValue(principal());

        const res = await ctx
          .http()
          .patch('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`)
          .send({ displayName: 'Alicia', email: 'attacker@example.com' });

        expect(res.status).toBe(400);

        const rows = await dataSource.query<{ count: string }[]>(
          'SELECT COUNT(*) AS count FROM users WHERE external_id = $1',
          ['sub-1'],
        );
        expect(rows[0].count).toBe('0');
      });

      it('sets avatarUrl when the request includes it', async () => {
        identityProvider.verifyToken.mockResolvedValue(principal());

        const res = await ctx
          .http()
          .patch('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`)
          .send({
            displayName: 'Alicia',
            avatarUrl: 'https://example.com/avatar.png',
          });

        expect(res.status).toBe(200);
        expect(res.body.avatarUrl).toBe('https://example.com/avatar.png');
      });

      it('leaves avatarUrl untouched when the request omits the key', async () => {
        identityProvider.verifyToken.mockResolvedValue(principal());
        await ctx
          .http()
          .patch('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`)
          .send({
            displayName: 'Alicia',
            avatarUrl: 'https://example.com/avatar.png',
          });

        const res = await ctx
          .http()
          .patch('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`)
          .send({ displayName: 'Alicia again' });

        expect(res.status).toBe(200);
        expect(res.body.avatarUrl).toBe('https://example.com/avatar.png');
      });

      it('clears avatarUrl when the request sends it as null', async () => {
        identityProvider.verifyToken.mockResolvedValue(principal());
        await ctx
          .http()
          .patch('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`)
          .send({
            displayName: 'Alicia',
            avatarUrl: 'https://example.com/avatar.png',
          });

        const res = await ctx
          .http()
          .patch('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`)
          .send({ displayName: 'Alicia', avatarUrl: null });

        expect(res.status).toBe(200);
        expect(res.body.avatarUrl).toBeNull();
      });

      it('rejects a non-URL avatarUrl with 400', async () => {
        identityProvider.verifyToken.mockResolvedValue(principal());

        const res = await ctx
          .http()
          .patch('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`)
          .send({ displayName: 'Alicia', avatarUrl: 'not-a-url' });

        expect(res.status).toBe(400);
      });

      it('sets locale and timezone when the request includes them', async () => {
        identityProvider.verifyToken.mockResolvedValue(principal());

        const res = await ctx
          .http()
          .patch('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`)
          .send({
            displayName: 'Alicia',
            locale: 'en-US',
            timezone: 'America/New_York',
          });

        expect(res.status).toBe(200);
        expect(res.body.locale).toBe('en-US');
        expect(res.body.timezone).toBe('America/New_York');
      });

      it('leaves locale and timezone untouched when the request omits those keys', async () => {
        identityProvider.verifyToken.mockResolvedValue(principal());
        await ctx
          .http()
          .patch('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`)
          .send({
            displayName: 'Alicia',
            locale: 'en-US',
            timezone: 'America/New_York',
          });

        const res = await ctx
          .http()
          .patch('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`)
          .send({ displayName: 'Alicia again' });

        expect(res.status).toBe(200);
        expect(res.body.locale).toBe('en-US');
        expect(res.body.timezone).toBe('America/New_York');
      });

      it('clears locale and timezone when the request sends them as null', async () => {
        identityProvider.verifyToken.mockResolvedValue(principal());
        await ctx
          .http()
          .patch('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`)
          .send({
            displayName: 'Alicia',
            locale: 'en-US',
            timezone: 'America/New_York',
          });

        const res = await ctx
          .http()
          .patch('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`)
          .send({ displayName: 'Alicia', locale: null, timezone: null });

        expect(res.status).toBe(200);
        expect(res.body.locale).toBeNull();
        expect(res.body.timezone).toBeNull();
      });

      it('rejects a non-locale-shaped locale with 400', async () => {
        identityProvider.verifyToken.mockResolvedValue(principal());

        const res = await ctx
          .http()
          .patch('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`)
          .send({ displayName: 'Alicia', locale: '!!!' });

        expect(res.status).toBe(400);
      });

      it('rejects an invalid timezone with 400', async () => {
        identityProvider.verifyToken.mockResolvedValue(principal());

        const res = await ctx
          .http()
          .patch('/api/users/me')
          .set('Authorization', `Bearer ${VALID_TOKEN}`)
          .send({ displayName: 'Alicia', timezone: 'not-a-timezone' });

        expect(res.status).toBe(400);
      });
    });
  });

  /**
   * The core guarantee `design.md` decision 5 exists for: a service that
   * enables neither `IDENTITY_PROVIDER` nor `TENANCY_ENABLED` must still
   * boot successfully and must not expose `/users/me`, even though this
   * context's code is always present. `core.module.ts`/`users.module.ts`
   * read both flags off `process.env` at module-*load* time (not per
   * request), so verifying this needs a genuinely fresh module evaluation
   * — `jest.resetModules()` plus a fresh dynamic import — not just a
   * second `createE2EApp()` call reusing the already-loaded `AppModule`
   * from the block above.
   */
  describe('with IDENTITY_PROVIDER and TENANCY_ENABLED both unset', () => {
    let ctx: E2EContext;

    beforeAll(async () => {
      delete process.env.IDENTITY_PROVIDER;
      delete process.env.TENANCY_ENABLED;
      jest.resetModules();

      const { createE2EApp } = await import('./helpers/app-bootstrap');
      ctx = await createE2EApp();
    });

    afterAll(async () => {
      await ctx.close();
    });

    it('boots successfully and does not register /users/me', async () => {
      const res = await ctx.http().get('/api/users/me');

      expect(res.status).toBe(404);
    });
  });
});
