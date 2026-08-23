import { UserIdValueObject } from '@contexts/users/domain/value-objects/user-id/user-id.vo';

const VALID_UUID = '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11';

describe('UserIdValueObject', () => {
  it('rejects an empty string', () => {
    expect(() => new UserIdValueObject('')).toThrow();
  });

  it('rejects a string that is not a valid uuid', () => {
    expect(() => new UserIdValueObject('not-a-uuid')).toThrow();
  });

  it('accepts a valid uuid and exposes it via .value', () => {
    const vo = new UserIdValueObject(VALID_UUID);

    expect(vo.value).toBe(VALID_UUID);
  });

  it('generates a random valid uuid when constructed with no value', () => {
    const vo = new UserIdValueObject();

    expect(() => new UserIdValueObject(vo.value)).not.toThrow();
  });

  it('reports equality based on value', () => {
    const a = new UserIdValueObject(VALID_UUID);
    const b = new UserIdValueObject(VALID_UUID);
    const c = new UserIdValueObject('5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a12');

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
