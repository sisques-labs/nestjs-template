import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

const send = jest.fn();

jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const actual = jest.requireActual(
    '@aws-sdk/client-cognito-identity-provider',
  );
  return {
    ...actual,
    CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
      send,
    })),
  };
});

const jwtVerify = jest.fn();
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn().mockReturnValue('jwks'),
  jwtVerify: (...args: unknown[]) => jwtVerify(...args),
}));

import { CognitoIdentityProvider } from './cognito-identity.provider';

function buildConfig(): jest.Mocked<ConfigService> {
  return {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string> = {
        COGNITO_REGION: 'us-east-1',
        COGNITO_USER_POOL_ID: 'us-east-1_pool',
        COGNITO_CLIENT_ID: 'client-id',
        COGNITO_HOSTED_UI_DOMAIN: 'my-app.auth.us-east-1.amazoncognito.com',
      };
      return values[key];
    }),
  } as unknown as jest.Mocked<ConfigService>;
}

describe('CognitoIdentityProvider', () => {
  beforeEach(() => {
    send.mockReset();
    jwtVerify.mockReset();
  });

  it('login() exchanges credentials for a token set', async () => {
    send.mockResolvedValueOnce({
      AuthenticationResult: {
        AccessToken: 'access',
        RefreshToken: 'refresh',
        ExpiresIn: 3600,
      },
    });
    const provider = new CognitoIdentityProvider(buildConfig());

    const result = await provider.login({
      email: 'user@example.com',
      password: 'secret',
    });

    expect(result).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 3600,
    });
  });

  it('login() throws when Cognito returns no access token', async () => {
    send.mockResolvedValueOnce({ AuthenticationResult: {} });
    const provider = new CognitoIdentityProvider(buildConfig());

    await expect(
      provider.login({ email: 'user@example.com', password: 'secret' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refreshToken() falls back to the given refresh token when Cognito omits one', async () => {
    send.mockResolvedValueOnce({
      AuthenticationResult: { AccessToken: 'access', ExpiresIn: 3600 },
    });
    const provider = new CognitoIdentityProvider(buildConfig());

    const result = await provider.refreshToken('original-refresh');

    expect(result.refreshToken).toBe('original-refresh');
  });

  it('verifyToken() maps a valid access token to an IPrincipal', async () => {
    jwtVerify.mockResolvedValueOnce({
      payload: {
        sub: 'user-123',
        token_use: 'access',
        client_id: 'client-id',
        email: 'user@example.com',
        'cognito:groups': ['admin'],
      },
    });
    const provider = new CognitoIdentityProvider(buildConfig());

    const principal = await provider.verifyToken('token');

    expect(principal.sub).toBe('user-123');
    expect(principal.roles).toEqual(['admin']);
  });

  it('verifyToken() rejects a token issued for a different app client', async () => {
    jwtVerify.mockResolvedValueOnce({
      payload: { sub: 'user-123', token_use: 'access', client_id: 'other' },
    });
    const provider = new CognitoIdentityProvider(buildConfig());

    await expect(provider.verifyToken('token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('verifyToken() rejects when signature verification throws', async () => {
    jwtVerify.mockRejectedValueOnce(new Error('bad signature'));
    const provider = new CognitoIdentityProvider(buildConfig());

    await expect(provider.verifyToken('token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('createUser() returns the sub attribute from the created user', async () => {
    send.mockResolvedValueOnce({
      User: {
        Username: 'user@example.com',
        Attributes: [{ Name: 'sub', Value: 'user-123' }],
      },
    });
    const provider = new CognitoIdentityProvider(buildConfig());

    const userId = await provider.createUser({ email: 'user@example.com' });

    expect(userId).toBe('user-123');
  });

  it('updateUserAttributes() is a no-op when no attributes are given', async () => {
    const provider = new CognitoIdentityProvider(buildConfig());

    await provider.updateUserAttributes('user-123', {});

    expect(send).not.toHaveBeenCalled();
  });

  it('disableUser(), deleteUser(), and resetPassword() delegate to the client', async () => {
    send.mockResolvedValue({});
    const provider = new CognitoIdentityProvider(buildConfig());

    await provider.disableUser('user-123');
    await provider.deleteUser('user-123');
    await provider.resetPassword('user-123');

    expect(send).toHaveBeenCalledTimes(3);
  });

  describe('getAuthorizationUrl()', () => {
    it('builds the Cognito Hosted UI authorization URL', async () => {
      const provider = new CognitoIdentityProvider(buildConfig());

      const url = await provider.getAuthorizationUrl({
        redirectUri: 'https://app.example.com/auth/oauth/callback',
        state: 'the-state',
        codeChallenge: 'the-challenge',
      });

      const parsed = new URL(url);
      expect(parsed.origin).toBe(
        'https://my-app.auth.us-east-1.amazoncognito.com',
      );
      expect(parsed.pathname).toBe('/oauth2/authorize');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('client_id')).toBe('client-id');
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'https://app.example.com/auth/oauth/callback',
      );
      expect(parsed.searchParams.get('state')).toBe('the-state');
      expect(parsed.searchParams.get('code_challenge')).toBe('the-challenge');
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
      expect(parsed.searchParams.get('scope')).toBe('openid profile email');
    });
  });

  describe('exchangeAuthorizationCode()', () => {
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
      fetchSpy = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('exchanges the authorization code for a token set', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            access_token: 'access',
            refresh_token: 'refresh',
            expires_in: 3600,
          }),
      } as Response);
      const provider = new CognitoIdentityProvider(buildConfig());

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
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://my-app.auth.us-east-1.amazoncognito.com/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
    });

    it('throws UnauthorizedException when Cognito returns a non-2xx response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'invalid_grant' }),
      } as Response);
      const provider = new CognitoIdentityProvider(buildConfig());

      await expect(
        provider.exchangeAuthorizationCode({
          code: 'bad-code',
          redirectUri: 'https://app.example.com/auth/oauth/callback',
          codeVerifier: 'the-verifier',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
