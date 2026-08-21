import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

const auth = {
  signInWithPassword: jest.fn(),
  refreshSession: jest.fn(),
  signInWithOAuth: jest.fn(),
  exchangeCodeForSession: jest.fn(),
  admin: {
    createUser: jest.fn(),
    updateUserById: jest.fn(),
    deleteUser: jest.fn(),
    getUserById: jest.fn(),
    generateLink: jest.fn(),
  },
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockImplementation(() => ({ auth })),
}));

const jwtVerify = jest.fn();
jest.mock('jose', () => ({
  jwtVerify: (...args: unknown[]) => jwtVerify(...args),
}));

import { SupabaseIdentityProvider } from './supabase-identity.provider';

function buildConfig(): jest.Mocked<ConfigService> {
  return {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string> = {
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        SUPABASE_JWT_SECRET: 'jwt-secret',
      };
      return values[key];
    }),
  } as unknown as jest.Mocked<ConfigService>;
}

describe('SupabaseIdentityProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('login() returns a token set on success', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'access',
          refresh_token: 'refresh',
          expires_in: 3600,
        },
      },
      error: null,
    });
    const provider = new SupabaseIdentityProvider(buildConfig());

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

  it('login() throws UnauthorizedException on provider error', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });
    const provider = new SupabaseIdentityProvider(buildConfig());

    await expect(
      provider.login({ email: 'user@example.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refreshToken() throws UnauthorizedException on provider error', async () => {
    auth.refreshSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Invalid refresh token' },
    });
    const provider = new SupabaseIdentityProvider(buildConfig());

    await expect(provider.refreshToken('bad-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('verifyToken() maps a valid token to an IPrincipal', async () => {
    jwtVerify.mockResolvedValueOnce({
      payload: {
        sub: 'user-123',
        email: 'user@example.com',
        app_metadata: { roles: ['user'] },
      },
    });
    const provider = new SupabaseIdentityProvider(buildConfig());

    const principal = await provider.verifyToken('token');

    expect(principal.sub).toBe('user-123');
  });

  it('verifyToken() rejects when signature verification throws', async () => {
    jwtVerify.mockRejectedValueOnce(new Error('bad signature'));
    const provider = new SupabaseIdentityProvider(buildConfig());

    await expect(provider.verifyToken('token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('createUser() returns the created user id', async () => {
    auth.admin.createUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    const provider = new SupabaseIdentityProvider(buildConfig());

    const userId = await provider.createUser({ email: 'user@example.com' });

    expect(userId).toBe('user-123');
  });

  it('createUser() surfaces provider errors', async () => {
    auth.admin.createUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Email already registered' },
    });
    const provider = new SupabaseIdentityProvider(buildConfig());

    await expect(
      provider.createUser({ email: 'user@example.com' }),
    ).rejects.toThrow('Email already registered');
  });

  it('disableUser() bans the account for a long duration', async () => {
    auth.admin.updateUserById.mockResolvedValueOnce({ error: null });
    const provider = new SupabaseIdentityProvider(buildConfig());

    await provider.disableUser('user-123');

    expect(auth.admin.updateUserById).toHaveBeenCalledWith('user-123', {
      ban_duration: '876000h',
    });
  });

  it('resetPassword() looks up the email and generates a recovery link', async () => {
    auth.admin.getUserById.mockResolvedValueOnce({
      data: { user: { email: 'user@example.com' } },
      error: null,
    });
    auth.admin.generateLink.mockResolvedValueOnce({ error: null });
    const provider = new SupabaseIdentityProvider(buildConfig());

    await provider.resetPassword('user-123');

    expect(auth.admin.generateLink).toHaveBeenCalledWith({
      type: 'recovery',
      email: 'user@example.com',
    });
  });

  it('resetPassword() throws when the user is not found', async () => {
    auth.admin.getUserById.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'User not found' },
    });
    const provider = new SupabaseIdentityProvider(buildConfig());

    await expect(provider.resetPassword('missing')).rejects.toThrow(
      'User not found',
    );
  });

  it('deleteUser() surfaces provider errors', async () => {
    auth.admin.deleteUser.mockResolvedValueOnce({
      error: { message: 'User not found' },
    });
    const provider = new SupabaseIdentityProvider(buildConfig());

    await expect(provider.deleteUser('missing')).rejects.toThrow(
      'User not found',
    );
  });

  it('getAuthorizationUrl() returns the provider-built OAuth URL', async () => {
    auth.signInWithOAuth.mockResolvedValueOnce({
      data: { url: 'https://project.supabase.co/auth/v1/authorize?...' },
      error: null,
    });
    const provider = new SupabaseIdentityProvider(buildConfig());

    const url = await provider.getAuthorizationUrl({
      redirectUri: 'https://app.example.com/auth/oauth/callback',
      state: 'the-state',
      codeChallenge: 'the-challenge',
    });

    expect(url).toBe('https://project.supabase.co/auth/v1/authorize?...');
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'https://app.example.com/auth/oauth/callback',
        skipBrowserRedirect: true,
        queryParams: { state: 'the-state' },
      },
    });
  });

  it('getAuthorizationUrl() throws UnauthorizedException on provider error', async () => {
    auth.signInWithOAuth.mockResolvedValueOnce({
      data: { url: null },
      error: { message: 'OAuth provider not configured' },
    });
    const provider = new SupabaseIdentityProvider(buildConfig());

    await expect(
      provider.getAuthorizationUrl({
        redirectUri: 'https://app.example.com/auth/oauth/callback',
        state: 'the-state',
        codeChallenge: 'the-challenge',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('exchangeAuthorizationCode() returns a token set on success', async () => {
    auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'access',
          refresh_token: 'refresh',
          expires_in: 3600,
        },
      },
      error: null,
    });
    const provider = new SupabaseIdentityProvider(buildConfig());

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
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('the-code');
  });

  it('exchangeAuthorizationCode() throws UnauthorizedException on provider error', async () => {
    auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Invalid authorization code' },
    });
    const provider = new SupabaseIdentityProvider(buildConfig());

    await expect(
      provider.exchangeAuthorizationCode({
        code: 'bad-code',
        redirectUri: 'https://app.example.com/auth/oauth/callback',
        codeVerifier: 'the-verifier',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
