import { extractBearerToken } from './extract-bearer-token';

describe('extractBearerToken', () => {
  it('returns the token from a well-formed Bearer header', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123');
  });

  it('returns null when the header is undefined', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('returns null for a non-Bearer scheme', () => {
    expect(extractBearerToken('Basic abc123')).toBeNull();
  });

  it('returns null when the token is empty after trimming', () => {
    expect(extractBearerToken('Bearer    ')).toBeNull();
  });
});
