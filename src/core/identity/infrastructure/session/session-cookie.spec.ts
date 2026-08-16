import {
  buildSessionCookie,
  clearSessionCookieOptions,
} from './session-cookie';

describe('session-cookie', () => {
  describe('buildSessionCookie()', () => {
    it('returns HttpOnly/Secure/SameSite=Lax attributes with maxAge in milliseconds', () => {
      const result = buildSessionCookie('session-id-1', 'session', 86400);

      expect(result).toEqual({
        name: 'session',
        value: 'session-id-1',
        options: {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 86400 * 1000,
        },
      });
    });
  });

  describe('clearSessionCookieOptions()', () => {
    it('returns the same identifying attributes needed to clear a matching cookie', () => {
      const result = clearSessionCookieOptions('session');

      expect(result).toEqual({
        name: 'session',
        options: {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/',
        },
      });
    });
  });
});
