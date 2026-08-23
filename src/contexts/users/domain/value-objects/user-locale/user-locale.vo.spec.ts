import { UserLocaleValueObject } from '@contexts/users/domain/value-objects/user-locale/user-locale.vo';

describe('UserLocaleValueObject', () => {
  it('rejects an empty string', () => {
    expect(() => new UserLocaleValueObject('')).toThrow();
  });

  it('accepts a bare language code', () => {
    const vo = new UserLocaleValueObject('en');

    expect(vo.value).toBe('en');
  });

  it('accepts a language-region tag (nestjs-kit LocaleValueObject v1.6.1 rejects this shape — see the doc comment)', () => {
    const vo = new UserLocaleValueObject('en-US');

    expect(vo.value).toBe('en-US');
  });

  it('accepts a language-script-region tag', () => {
    const vo = new UserLocaleValueObject('zh-Hans-CN');

    expect(vo.value).toBe('zh-Hans-CN');
  });

  it('trims surrounding whitespace', () => {
    const vo = new UserLocaleValueObject('  es-ES  ');

    expect(vo.value).toBe('es-ES');
  });

  it('rejects a non-locale-shaped string', () => {
    expect(() => new UserLocaleValueObject('!!!')).toThrow();
  });

  it('reports equality based on value', () => {
    const a = new UserLocaleValueObject('en-US');
    const b = new UserLocaleValueObject('en-US');
    const c = new UserLocaleValueObject('es-ES');

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
