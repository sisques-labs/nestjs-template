import { UserTenantIdValueObject } from '@contexts/users/domain/value-objects/user-tenant-id/user-tenant-id.vo';

const VALID_UUID = '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11';

describe('UserTenantIdValueObject', () => {
  it('rejects an empty string', () => {
    expect(() => new UserTenantIdValueObject('')).toThrow();
  });

  it('rejects a string that is not a valid uuid', () => {
    expect(() => new UserTenantIdValueObject('not-a-uuid')).toThrow();
  });

  it('accepts a valid uuid and exposes it via .value', () => {
    const vo = new UserTenantIdValueObject(VALID_UUID);

    expect(vo.value).toBe(VALID_UUID);
  });

  it('reports equality based on value', () => {
    const a = new UserTenantIdValueObject(VALID_UUID);
    const b = new UserTenantIdValueObject(VALID_UUID);
    const c = new UserTenantIdValueObject(
      '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a12',
    );

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
