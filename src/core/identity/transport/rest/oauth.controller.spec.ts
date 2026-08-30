import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

import { IIdentityProvider } from '@core/identity/application/ports/identity-provider.port';
import { ISessionStore } from '@core/identity/application/ports/session-store.port';
import { OAuthStateService } from '@core/identity/application/services/oauth-state.service';
import { OAuthController } from './oauth.controller';

function buildIdentityProvider(): jest.Mocked<IIdentityProvider> {
  return {
    login: jest.fn(),
    refreshToken: jest.fn(),
    verifyToken: jest.fn(),
    createUser: jest.fn(),
    disableUser: jest.fn(),
    deleteUser: jest.fn(),
    updateUserAttributes: jest.fn(),
    resetPassword: jest.fn(),
    getAuthorizationUrl: jest.fn(),
    exchangeAuthorizationCode: jest.fn(),
  };
}

function buildSessionStore(): jest.Mocked<ISessionStore> {
  return {
    set: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  };
}

function buildOAuthStateService(): jest.Mocked<OAuthStateService> {
  return {
    start: jest.fn(),
    consume: jest.fn(),
  } as unknown as jest.Mocked<OAuthStateService>;
}

const CONFIG_VALUES: Record<string, string | number> = {
  OAUTH_REDIRECT_URI: 'https://app.example.com/auth/oauth/callback',
  OAUTH_SUCCESS_REDIRECT_URL: 'https://app.example.com/',
  SESSION_COOKIE_NAME: 'session',
  SESSION_TTL_SECONDS: 86400,
};

function buildConfigService(): jest.Mocked<ConfigService> {
  return {
    get: jest.fn((key: string) => CONFIG_VALUES[key]),
    getOrThrow: jest.fn((key: string) => {
      const value = CONFIG_VALUES[key];
      if (value === undefined) {
        throw new Error(`Missing config value: ${key}`);
      }
      return value;
    }),
  } as unknown as jest.Mocked<ConfigService>;
}

function buildResponse(): jest.Mocked<Response> {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
  } as unknown as jest.Mocked<Response>;
}

function buildRequest(cookies: Record<string, string> = {}): Request {
  return { cookies } as unknown as Request;
}

describe('OAuthController', () => {
  it('start() sets the nonce cookie and redirects to the provider authorization URL', async () => {
    const identityProvider = buildIdentityProvider();
    const sessionStore = buildSessionStore();
    const oauthStateService = buildOAuthStateService();
    oauthStateService.start.mockResolvedValue({
      nonce: 'nonce-1',
      state: 'state-1',
      codeVerifier: 'verifier-1',
      codeChallenge: 'challenge-1',
    });
    identityProvider.getAuthorizationUrl.mockResolvedValue(
      'https://idp.example.com/authorize?...',
    );
    const controller = new OAuthController(
      identityProvider,
      sessionStore,
      oauthStateService,
      buildConfigService(),
    );
    const res = buildResponse();

    await controller.start(res);

    expect(res.cookie).toHaveBeenCalledWith(
      'oauth_nonce',
      'nonce-1',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
    expect(identityProvider.getAuthorizationUrl).toHaveBeenCalledWith({
      redirectUri: 'https://app.example.com/auth/oauth/callback',
      state: 'state-1',
      codeChallenge: 'challenge-1',
    });
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      'https://idp.example.com/authorize?...',
    );
  });

  describe('callback()', () => {
    it('creates a session, sets the session cookie, and redirects to the success URL on valid state', async () => {
      const identityProvider = buildIdentityProvider();
      const sessionStore = buildSessionStore();
      const oauthStateService = buildOAuthStateService();
      oauthStateService.consume.mockResolvedValue({
        codeVerifier: 'verifier-1',
      });
      identityProvider.exchangeAuthorizationCode.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 3600,
      });
      identityProvider.verifyToken.mockResolvedValue({
        sub: 'user-1',
        email: 'user@example.com',
        roles: [],
        tenantIds: [],
      });
      const controller = new OAuthController(
        identityProvider,
        sessionStore,
        oauthStateService,
        buildConfigService(),
      );
      const res = buildResponse();
      const req = buildRequest({ oauth_nonce: 'nonce-1' });

      await controller.callback('the-code', 'state-1', req, res);

      expect(oauthStateService.consume).toHaveBeenCalledWith(
        'nonce-1',
        'state-1',
      );
      expect(identityProvider.exchangeAuthorizationCode).toHaveBeenCalledWith({
        code: 'the-code',
        redirectUri: 'https://app.example.com/auth/oauth/callback',
        codeVerifier: 'verifier-1',
      });
      expect(sessionStore.set).toHaveBeenCalledWith(
        expect.stringMatching(/^session:/),
        expect.objectContaining({
          principal: expect.objectContaining({ sub: 'user-1' }),
        }),
        86400,
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'session',
        expect.any(String),
        expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        'oauth_nonce',
        expect.any(Object),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        302,
        'https://app.example.com/',
      );
    });

    it('throws UnauthorizedException and creates no session when the nonce cookie is missing', async () => {
      const identityProvider = buildIdentityProvider();
      const sessionStore = buildSessionStore();
      const oauthStateService = buildOAuthStateService();
      const controller = new OAuthController(
        identityProvider,
        sessionStore,
        oauthStateService,
        buildConfigService(),
      );
      const res = buildResponse();
      const req = buildRequest();

      await expect(
        controller.callback('the-code', 'state-1', req, res),
      ).rejects.toThrow(UnauthorizedException);

      expect(oauthStateService.consume).not.toHaveBeenCalled();
      expect(sessionStore.set).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException and creates no session when state is invalid/expired', async () => {
      const identityProvider = buildIdentityProvider();
      const sessionStore = buildSessionStore();
      const oauthStateService = buildOAuthStateService();
      oauthStateService.consume.mockResolvedValue(null);
      const controller = new OAuthController(
        identityProvider,
        sessionStore,
        oauthStateService,
        buildConfigService(),
      );
      const res = buildResponse();
      const req = buildRequest({ oauth_nonce: 'nonce-1' });

      await expect(
        controller.callback('the-code', 'wrong-state', req, res),
      ).rejects.toThrow(UnauthorizedException);

      expect(identityProvider.exchangeAuthorizationCode).not.toHaveBeenCalled();
      expect(sessionStore.set).not.toHaveBeenCalled();
    });
  });

  describe('logout()', () => {
    it('deletes the session record and clears the cookie when a session is present', async () => {
      const identityProvider = buildIdentityProvider();
      const sessionStore = buildSessionStore();
      const oauthStateService = buildOAuthStateService();
      const controller = new OAuthController(
        identityProvider,
        sessionStore,
        oauthStateService,
        buildConfigService(),
      );
      const res = buildResponse();
      const req = buildRequest({ session: 'session-id-1' });

      const result = await controller.logout(req, res);

      expect(sessionStore.delete).toHaveBeenCalledWith('session:session-id-1');
      expect(res.clearCookie).toHaveBeenCalledWith(
        'session',
        expect.any(Object),
      );
      expect(result).toEqual({ success: true });
    });

    it('still succeeds when no session cookie is present', async () => {
      const identityProvider = buildIdentityProvider();
      const sessionStore = buildSessionStore();
      const oauthStateService = buildOAuthStateService();
      const controller = new OAuthController(
        identityProvider,
        sessionStore,
        oauthStateService,
        buildConfigService(),
      );
      const res = buildResponse();
      const req = buildRequest();

      const result = await controller.logout(req, res);

      expect(sessionStore.delete).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith(
        'session',
        expect.any(Object),
      );
      expect(result).toEqual({ success: true });
    });
  });
});
