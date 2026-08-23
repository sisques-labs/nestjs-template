import { UserExternalIdValueObject } from '@contexts/users/domain/value-objects/user-external-id/user-external-id.vo';

describe('UserExternalIdValueObject', () => {
  it('rejects an empty string', () => {
    expect(() => new UserExternalIdValueObject('')).toThrow();
  });

  it('rejects a string that is only whitespace', () => {
    expect(() => new UserExternalIdValueObject('   ')).toThrow();
  });

  it('accepts a non-empty string and exposes it via .value', () => {
    const vo = new UserExternalIdValueObject('sub-42');

    expect(vo.value).toBe('sub-42');
  });

  it('trims surrounding whitespace', () => {
    const vo = new UserExternalIdValueObject('  sub-42  ');

    expect(vo.value).toBe('sub-42');
  });

  it('reports equality based on value', () => {
    const a = new UserExternalIdValueObject('same-sub');
    const b = new UserExternalIdValueObject('same-sub');
    const c = new UserExternalIdValueObject('different-sub');

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
