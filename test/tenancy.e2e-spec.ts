import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

import {
  IDENTITY_PROVIDER,
  IIdentityProvider,
} from '../src/core/identity/application/ports/identity-provider.port';
import { IPrincipal } from '../src/core/identity/application/ports/interfaces/principal.interface';
import { Role } from '../src/core/identity/domain/enums/role.enum';
import { IdentityGuard } from '../src/core/identity/infrastructure/guards/identity.guard';
import { TenantContextService } from '../src/core/tenancy/application/services/tenant-context.service';
import { TenantContextInterceptor } from '../src/core/tenancy/infrastructure/interceptors/tenant-context.interceptor';
import { TenantGuard } from '../src/core/tenancy/infrastructure/guards/tenant.guard';
import { TenancyModule } from '../src/core/tenancy/tenancy.module';
import type { E2EContext } from './helpers/app-bootstrap';

const VALID_TOKEN = 'valid-token';

function principalWithTenants(tenantIds: string[]): IPrincipal {
  return {
    sub: 'user-1',
    email: 'user@example.com',
    roles: [Role.USER],
    tenantIds,
  };
}

/**
 * Ad-hoc route exercising `TenantGuard` + `TenantContextInterceptor` —
 * this template has no bounded context with a real protected route yet
 * (mirrors `ProtectedTestController` in `identity.e2e-spec.ts`).
 *
 * The handler `await`s a real query (rather than reading
 * `TenantContextService.get()` synchronously) specifically to prove the
 * `AsyncLocalStorage` context survives an async hop through the handler —
 * the exact production concern documented and verified in
 * `tenant-context.interceptor.ts` before this test existed.
 */
@Controller('test-tenant')
class TenantTestController {
  constructor(
    private readonly tenantContextService: TenantContextService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get('whoami')
  @UseGuards(IdentityGuard, TenantGuard)
  @UseInterceptors(TenantContextInterceptor)
  async whoami(): Promise<{ tenantId: string | undefined }> {
    await this.dataSource.query('SELECT 1');
    return { tenantId: this.tenantContextService.get() };
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

describe('Tenancy (e2e)', () => {
  let ctx: E2EContext;
  let dataSource: DataSource;
  let identityProvider: jest.Mocked<IIdentityProvider>;

  beforeAll(async () => {
    // IDENTITY_PROVIDER and TENANCY_ENABLED must be set before AppModule
    // (and core.module.ts, which reads both at module-*load* time) is
    // required — hence the dynamic import here rather than a static one at
    // the top of this file. A static `import` is hoisted by TypeScript/Jest
    // above any other top-level code, so setting `process.env.X` textually
    // above it would NOT run before that import's `require()` call. See the
    // identical comment in `identity.e2e-spec.ts`.
    process.env.IDENTITY_PROVIDER = 'oidc';
    process.env.OIDC_ISSUER_URL = 'https://idp.example.com';
    process.env.OIDC_CLIENT_ID = 'test-client';
    process.env.OIDC_CLIENT_SECRET = 'test-secret';
    process.env.TENANCY_ENABLED = 'true';

    const { createE2EApp } = await import('./helpers/app-bootstrap');

    identityProvider = buildIdentityProvider();

    // `TenancyModule` is NOT `@Global()` (unlike `IdentityModule`) —
    // `AppModule` pulls it into `CoreModule`'s scope, but doesn't export it
    // any further, so `TenantTestController` (declared directly on the root
    // testing module, not inside AppModule's own tree) can't resolve
    // `TenantGuard`/`TenantContextInterceptor`/`TenantContextService`
    // without importing `TenancyModule` here too. Nest de-duplicates module
    // instantiation by class reference, so this resolves to the same
    // singleton providers `CoreModule`'s own import of `TenancyModule`
    // would use — there's no risk of two independent
    // `TenantContextService` instances existing.
    ctx = await createE2EApp({
      imports: [TenancyModule],
      controllers: [TenantTestController],
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

  describe('TenantGuard / TenantContextInterceptor on a guarded route', () => {
    it('rejects a request with no Authorization header (IdentityGuard runs first)', async () => {
      const res = await ctx.http().get('/api/test-tenant/whoami');

      expect(res.status).toBe(401);
    });

    it('rejects a principal with no tenant claim with 403', async () => {
      identityProvider.verifyToken.mockResolvedValue(principalWithTenants([]));

      const res = await ctx
        .http()
        .get('/api/test-tenant/whoami')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(403);
    });

    it('resolves the internal tenant id for a valid tenant claim, surviving an async hop, and persists a real tenants row', async () => {
      identityProvider.verifyToken.mockResolvedValue(
        principalWithTenants(['ext-tenant-1']),
      );

      const res = await ctx
        .http()
        .get('/api/test-tenant/whoami')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.tenantId).toBe('string');
      // The resolved id is the internal UUID primary key, not the raw
      // external claim value.
      expect(res.body.tenantId).not.toBe('ext-tenant-1');

      const rows = await dataSource.query<
        { id: string; external_id: string }[]
      >('SELECT id, external_id FROM tenants WHERE external_id = $1', [
        'ext-tenant-1',
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(res.body.tenantId);
    });

    it('does not create a duplicate tenants row for a second request bearing the same external tenant id', async () => {
      identityProvider.verifyToken.mockResolvedValue(
        principalWithTenants(['ext-tenant-1']),
      );

      const first = await ctx
        .http()
        .get('/api/test-tenant/whoami')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);
      const second = await ctx
        .http()
        .get('/api/test-tenant/whoami')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.tenantId).toBe(first.body.tenantId);

      const rows = await dataSource.query<{ count: string }[]>(
        'SELECT COUNT(*) AS count FROM tenants WHERE external_id = $1',
        ['ext-tenant-1'],
      );

      expect(rows[0].count).toBe('1');
    });
  });

  describe('X-Tenant-Id header selection for a multi-tenant principal', () => {
    it('rejects a principal with multiple tenants and no header with 403 (ambiguous)', async () => {
      identityProvider.verifyToken.mockResolvedValue(
        principalWithTenants(['ext-tenant-1', 'ext-tenant-2']),
      );

      const res = await ctx
        .http()
        .get('/api/test-tenant/whoami')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(403);
    });

    it('resolves to the tenant named by the header when it is one of the tenants the principal belongs to', async () => {
      identityProvider.verifyToken.mockResolvedValue(
        principalWithTenants(['ext-tenant-1', 'ext-tenant-2']),
      );

      const res = await ctx
        .http()
        .get('/api/test-tenant/whoami')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .set('X-Tenant-Id', 'ext-tenant-2');

      expect(res.status).toBe(200);
      expect(typeof res.body.tenantId).toBe('string');

      const rows = await dataSource.query<
        { id: string; external_id: string }[]
      >('SELECT id, external_id FROM tenants WHERE external_id = $1', [
        'ext-tenant-2',
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(res.body.tenantId);

      // The other tenant the principal belongs to must NOT have been
      // upserted just because it appears in `tenantIds` — only the
      // header-selected tenant is touched.
      const otherRows = await dataSource.query<{ count: string }[]>(
        'SELECT COUNT(*) AS count FROM tenants WHERE external_id = $1',
        ['ext-tenant-1'],
      );
      expect(otherRows[0].count).toBe('0');
    });

    it('rejects a header naming a tenant the principal does NOT belong to with 403', async () => {
      identityProvider.verifyToken.mockResolvedValue(
        principalWithTenants(['ext-tenant-1', 'ext-tenant-2']),
      );

      const res = await ctx
        .http()
        .get('/api/test-tenant/whoami')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .set('X-Tenant-Id', 'ext-tenant-not-mine');

      expect(res.status).toBe(403);

      const rows = await dataSource.query<{ count: string }[]>(
        'SELECT COUNT(*) AS count FROM tenants WHERE external_id = $1',
        ['ext-tenant-not-mine'],
      );
      expect(rows[0].count).toBe('0');
    });

    it('still resolves the sole tenant when a single-tenant principal sends no header', async () => {
      identityProvider.verifyToken.mockResolvedValue(
        principalWithTenants(['ext-tenant-solo']),
      );

      const res = await ctx
        .http()
        .get('/api/test-tenant/whoami')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(200);

      const rows = await dataSource.query<
        { id: string; external_id: string }[]
      >('SELECT id, external_id FROM tenants WHERE external_id = $1', [
        'ext-tenant-solo',
      ]);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(res.body.tenantId);
    });
  });

  // `TenantScopedRepository` end-to-end isolation (spec's "Repository-level
  // tenant scoping" requirement) is deliberately NOT covered here. No
  // bounded context in this template extends `TenantScopedRepository` yet
  // (see `add-tenant-context` task 4.2 / `src/core/tenancy/README.md`'s "No
  // context extends this yet") — there's no real tenant-scoped
  // entity/table to seed two tenants' worth of rows against without
  // fabricating a throwaway table+entity solely for this spec. The class's
  // query-building behavior (adds `tenant_id = :tenantId`, throws with no
  // context) already has direct unit coverage in
  // `src/core/tenancy/infrastructure/persistence/typeorm/tenant-scoped.repository.spec.ts`.
  // The scenario this file DOES cover end-to-end — `TenantGuard` resolving
  // and seeding the correct internal tenant id via `TenantContextService`,
  // surviving a real async hop over a real HTTP request — is the one piece
  // `TenantScopedRepository`'s unit tests can't exercise on their own
  // (they construct the tenant context manually rather than through the
  // real guard/interceptor pipeline), and is exactly what a future
  // context's `TenantScopedRepository` subclass will depend on.
});
