import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

const discovery = jest.fn();
const genericGrantRequest = jest.fn();
const refreshTokenGrant = jest.fn();
const buildAuthorizationUrl = jest.fn();
const authorizationCodeGrant = jest.fn();
const skipStateCheck = Symbol('skipStateCheck');

jest.mock('openid-client', () => ({
  discovery: (...args: unknown[]) => discovery(...args),
  genericGrantRequest: (...args: unknown[]) => genericGrantRequest(...args),
  refreshTokenGrant: (...args: unknown[]) => refreshTokenGrant(...args),
  buildAuthorizationUrl: (...args: unknown[]) => buildAuthorizationUrl(...args),
  authorizationCodeGrant: (...args: unknown[]) =>
    authorizationCodeGrant(...args),
  skipStateCheck,
}));

const jwtVerify = jest.fn();
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn().mockReturnValue('jwks'),
  jwtVerify: (...args: unknown[]) => jwtVerify(...args),
}));

import { OidcIdentityProvider } from './oidc-identity.provider';

function buildConfig(
  overrides: Record<string, string> = {},
): jest.Mocked<ConfigService> {
  const values: Record<string, string> = {
    OIDC_ISSUER_URL: 'https://idp.example.com',
    OIDC_CLIENT_ID: 'client-id',
    OIDC_CLIENT_SECRET: 'client-secret',
    ...overrides,
  };
  return {
    getOrThrow: jest.fn((key: string) => values[key]),
    get: jest.fn((key: string) => values[key]),
  } as unknown as jest.Mocked<ConfigService>;
}

const configurationStub = {
  serverMetadata: () => ({
    issuer: 'https://idp.example.com',
    jwks_uri: 'https://idp.example.com/jwks',
  }),
};

function fakeConfiguration() {
  return configurationStub;
}

describe('OidcIdentityProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    discovery.mockResolvedValue(fakeConfiguration());
  });

  it('login() performs a password grant and caches the discovered configuration', async () => {
    genericGrantRequest.mockResolvedValue({
      access_token: 'access',
      refresh_token: 'refresh',
      expires_in: 3600,
    });
    const provider = new OidcIdentityProvider(buildConfig());

    const result = await provider.login({
      email: 'user@example.com',
      password: 'secret',
    });
    await provider.login({ email: 'user@example.com', password: 'secret' });

    expect(result).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 3600,
    });
    expect(discovery).toHaveBeenCalledTimes(1);
  });

  it('refreshToken() falls back to the given refresh token when the IdP omits one', async () => {
    refreshTokenGrant.mockResolvedValueOnce({
      access_token: 'access',
      expires_in: 3600,
    });
    const provider = new OidcIdentityProvider(buildConfig());

    const result = await provider.refreshToken('original-refresh');

    expect(result.refreshToken).toBe('original-refresh');
  });

  it('verifyToken() maps a valid token using the configured role claim', async () => {
    jwtVerify.mockResolvedValueOnce({
      payload: { sub: 'user-123', roles: ['admin'] },
    });
    const provider = new OidcIdentityProvider(
      buildConfig({ OIDC_ROLE_CLAIM: 'roles' }),
    );

    const principal = await provider.verifyToken('token');

    expect(principal.sub).toBe('user-123');
    expect(principal.roles).toEqual(['admin']);
  });

  it('verifyToken() rejects when signature verification throws', async () => {
    jwtVerify.mockRejectedValueOnce(new Error('bad signature'));
    const provider = new OidcIdentityProvider(buildConfig());

    await expect(provider.verifyToken('token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it.each([
    [
      'createUser',
      () =>
        new OidcIdentityProvider(buildConfig()).createUser({
          email: 'a@b.com',
        }),
    ],
    [
      'disableUser',
      () => new OidcIdentityProvider(buildConfig()).disableUser('id'),
    ],
    [
      'deleteUser',
      () => new OidcIdentityProvider(buildConfig()).deleteUser('id'),
    ],
    [
      'updateUserAttributes',
      () =>
        new OidcIdentityProvider(buildConfig()).updateUserAttributes('id', {}),
    ],
    [
      'resetPassword',
      () => new OidcIdentityProvider(buildConfig()).resetPassword('id'),
    ],
  ])('%s() rejects — no standard OIDC admin API', async (_name, invoke) => {
    await expect(invoke()).rejects.toThrow(
      /not supported by the generic OIDC adapter/,
    );
  });

  describe('getAuthorizationUrl()', () => {
    it('builds the authorization URL via openid-client', async () => {
      buildAuthorizationUrl.mockReturnValueOnce(
        new URL('https://idp.example.com/authorize?state=the-state'),
      );
      const provider = new OidcIdentityProvider(buildConfig());

      const url = await provider.getAuthorizationUrl({
        redirectUri: 'https://app.example.com/auth/oauth/callback',
        state: 'the-state',
        codeChallenge: 'the-challenge',
      });

      expect(url).toBe('https://idp.example.com/authorize?state=the-state');
      expect(buildAuthorizationUrl).toHaveBeenCalledWith(fakeConfiguration(), {
        redirect_uri: 'https://app.example.com/auth/oauth/callback',
        scope: 'openid profile email',
        state: 'the-state',
        code_challenge: 'the-challenge',
        code_challenge_method: 'S256',
      });
    });
  });

  describe('exchangeAuthorizationCode()', () => {
    it('performs the authorization code grant and returns a token set', async () => {
      authorizationCodeGrant.mockResolvedValueOnce({
        access_token: 'access',
        refresh_token: 'refresh',
        expires_in: 3600,
      });
      const provider = new OidcIdentityProvider(buildConfig());

      const result = await provider.exchangeAuthorizationCode({
        code: 'the-code',
        redirectUri: 'https://app.example.com/auth/oauth/callback',
        codeVerifier: 'the-verifier',
      });

      expect(result).toEqual({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 3600,
      });
      expect(authorizationCodeGrant).toHaveBeenCalledWith(
        fakeConfiguration(),
        new URL('https://app.example.com/auth/oauth/callback?code=the-code'),
        {
          pkceCodeVerifier: 'the-verifier',
          expectedState: skipStateCheck,
        },
      );
    });

    it('throws UnauthorizedException when the grant fails', async () => {
      authorizationCodeGrant.mockRejectedValueOnce(new Error('invalid_grant'));
      const provider = new OidcIdentityProvider(buildConfig());

      await expect(
        provider.exchangeAuthorizationCode({
          code: 'bad-code',
          redirectUri: 'https://app.example.com/auth/oauth/callback',
          codeVerifier: 'the-verifier',
        }),
      ).rejects.toThrow('invalid_grant');
    });
  });
});
