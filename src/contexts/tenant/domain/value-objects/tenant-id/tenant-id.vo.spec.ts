import { TenantIdValueObject } from '@contexts/tenant/domain/value-objects/tenant-id/tenant-id.vo';

const VALID_UUID = '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11';

describe('TenantIdValueObject', () => {
  it('rejects an empty string', () => {
    expect(() => new TenantIdValueObject('')).toThrow();
  });

  it('rejects a string that is not a valid uuid', () => {
    expect(() => new TenantIdValueObject('not-a-uuid')).toThrow();
  });

  it('accepts a valid uuid and exposes it via .value', () => {
    const vo = new TenantIdValueObject(VALID_UUID);

    expect(vo.value).toBe(VALID_UUID);
  });

  it('generates a random valid uuid when constructed with no value', () => {
    const vo = new TenantIdValueObject();

    expect(() => new TenantIdValueObject(vo.value)).not.toThrow();
  });

  it('reports equality based on value', () => {
    const a = new TenantIdValueObject(VALID_UUID);
    const b = new TenantIdValueObject(VALID_UUID);
    const c = new TenantIdValueObject('5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a12');

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
