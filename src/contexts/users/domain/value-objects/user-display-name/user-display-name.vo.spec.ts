import {
  USER_DISPLAY_NAME_MAX_LENGTH,
  UserDisplayNameValueObject,
} from '@contexts/users/domain/value-objects/user-display-name/user-display-name.vo';

describe('UserDisplayNameValueObject', () => {
  it('rejects an empty string', () => {
    expect(() => new UserDisplayNameValueObject('')).toThrow();
  });

  it('rejects a string that is only whitespace', () => {
    expect(() => new UserDisplayNameValueObject('   ')).toThrow();
  });

  it('accepts a non-empty string and exposes it via .value', () => {
    const vo = new UserDisplayNameValueObject('Alice');

    expect(vo.value).toBe('Alice');
  });

  it('trims surrounding whitespace', () => {
    const vo = new UserDisplayNameValueObject('  Alice  ');

    expect(vo.value).toBe('Alice');
  });

  it('rejects a string longer than the max length', () => {
    const tooLong = 'a'.repeat(USER_DISPLAY_NAME_MAX_LENGTH + 1);

    expect(() => new UserDisplayNameValueObject(tooLong)).toThrow();
  });

  it('accepts a string exactly at the max length', () => {
    const atLimit = 'a'.repeat(USER_DISPLAY_NAME_MAX_LENGTH);

    expect(() => new UserDisplayNameValueObject(atLimit)).not.toThrow();
  });

  it('reports equality based on value', () => {
    const a = new UserDisplayNameValueObject('Alice');
    const b = new UserDisplayNameValueObject('Alice');
    const c = new UserDisplayNameValueObject('Bob');

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
