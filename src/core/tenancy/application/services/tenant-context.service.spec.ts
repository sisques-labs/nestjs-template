import { NoTenantContextException } from '@core/tenancy/application/exceptions/no-tenant-context.exception';
import { TenantContextService } from './tenant-context.service';

describe('TenantContextService', () => {
  it('returns undefined before any run() call', () => {
    const service = new TenantContextService();

    expect(service.get()).toBeUndefined();
  });

  it('returns the tenant id inside run()', () => {
    const service = new TenantContextService();

    service.run('tenant-1', () => {
      expect(service.get()).toBe('tenant-1');
    });
  });

  it('returns undefined again after run() completes', () => {
    const service = new TenantContextService();

    service.run('tenant-1', () => {
      // no-op
    });

    expect(service.get()).toBeUndefined();
  });

  it('keeps the tenant id visible across nested async calls within run()', async () => {
    const service = new TenantContextService();

    await service.run('tenant-1', async () => {
      expect(service.get()).toBe('tenant-1');
      await Promise.resolve();
      expect(service.get()).toBe('tenant-1');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(service.get()).toBe('tenant-1');
    });

    expect(service.get()).toBeUndefined();
  });

  describe('require()', () => {
    it('throws NoTenantContextException before any run() call', () => {
      const service = new TenantContextService();

      expect(() => service.require()).toThrow(NoTenantContextException);
    });

    it('returns the tenant id inside run()', () => {
      const service = new TenantContextService();

      service.run('tenant-1', () => {
        expect(service.require()).toBe('tenant-1');
      });
    });
  });

  it('isolates concurrent run() calls from each other', async () => {
    const service = new TenantContextService();
    const observed: Record<string, string[]> = {
      'tenant-a': [],
      'tenant-b': [],
    };

    async function work(tenantId: 'tenant-a' | 'tenant-b'): Promise<void> {
      await service.run(tenantId, async () => {
        observed[tenantId].push(service.get() ?? 'MISSING');
        await new Promise((resolve) => setTimeout(resolve, 10));
        observed[tenantId].push(service.get() ?? 'MISSING');
        await Promise.resolve();
        observed[tenantId].push(service.get() ?? 'MISSING');
      });
    }

    await Promise.all([work('tenant-a'), work('tenant-b')]);

    expect(observed['tenant-a']).toEqual(['tenant-a', 'tenant-a', 'tenant-a']);
    expect(observed['tenant-b']).toEqual(['tenant-b', 'tenant-b', 'tenant-b']);
  });
});
