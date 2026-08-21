import { TenantExternalIdValueObject } from '@contexts/tenant/domain/value-objects/tenant-external-id/tenant-external-id.vo';

describe('TenantExternalIdValueObject', () => {
  it('rejects an empty string', () => {
    expect(() => new TenantExternalIdValueObject('')).toThrow();
  });

  it('rejects a string that is only whitespace', () => {
    expect(() => new TenantExternalIdValueObject('   ')).toThrow();
  });

  it('accepts a non-empty string and exposes it via .value', () => {
    const vo = new TenantExternalIdValueObject('tenant-external-abc123');

    expect(vo.value).toBe('tenant-external-abc123');
  });

  it('trims surrounding whitespace', () => {
    const vo = new TenantExternalIdValueObject('  tenant-external-abc123  ');

    expect(vo.value).toBe('tenant-external-abc123');
  });

  it('reports equality based on value', () => {
    const a = new TenantExternalIdValueObject('same-external-id');
    const b = new TenantExternalIdValueObject('same-external-id');
    const c = new TenantExternalIdValueObject('different-external-id');

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
