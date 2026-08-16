import { randomUUID } from 'crypto';

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';

import {
  IDENTITY_PROVIDER,
  IIdentityProvider,
} from '../../application/ports/identity-provider.port';
import { ISessionRecord } from '../../application/ports/session-record.interface';
import {
  ISessionStore,
  SESSION_STORE,
} from '../../application/ports/session-store.port';
import { OAuthStateService } from '../../application/services/oauth-state.service';
import {
  buildSessionCookie,
  clearSessionCookieOptions,
} from '../../infrastructure/session/session-cookie';

const OAUTH_NONCE_COOKIE_NAME = 'oauth_nonce';
const OAUTH_NONCE_TTL_SECONDS = 300;
const DEFAULT_SESSION_COOKIE_NAME = 'session';
const DEFAULT_SESSION_TTL_SECONDS = 86400;

/**
 * BFF-style OAuth/social login: `GET /auth/oauth/start` redirects to the
 * active `IIdentityProvider`'s authorization endpoint,
 * `GET /auth/oauth/callback` exchanges the returned code for a token set
 * and opens a server-side session, `POST /auth/logout` destroys it. The
 * provider's `accessToken`/`refreshToken` never reach the browser — only
 * an opaque session id does, via an `HttpOnly` cookie. Only registered
 * when `OAUTH_SESSION_ENABLED=true` (see `identity.module.ts`).
 */
@ApiTags('auth')
@Controller('auth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    @Inject(IDENTITY_PROVIDER)
    private readonly identityProvider: IIdentityProvider,
    @Inject(SESSION_STORE)
    private readonly sessionStore: ISessionStore,
    private readonly oauthStateService: OAuthStateService,
    private readonly configService: ConfigService,
  ) {}

  @Get('oauth/start')
  @ApiOperation({
    summary: "Redirect to the active provider's authorization endpoint",
  })
  async start(@Res() res: Response): Promise<void> {
    this.logger.log('OAuth start requested');

    const redirectUri =
      this.configService.getOrThrow<string>('OAUTH_REDIRECT_URI');
    const { nonce, state, codeChallenge } =
      await this.oauthStateService.start();

    const nonceCookie = buildSessionCookie(
      nonce,
      OAUTH_NONCE_COOKIE_NAME,
      OAUTH_NONCE_TTL_SECONDS,
    );
    res.cookie(nonceCookie.name, nonceCookie.value, nonceCookie.options);

    const url = await this.identityProvider.getAuthorizationUrl({
      redirectUri,
      state,
      codeChallenge,
    });
    res.redirect(302, url);
  }

  @Get('oauth/callback')
  @ApiOperation({
    summary: 'Exchange the authorization code for a session',
  })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    this.logger.log('OAuth callback received');

    const nonce = req.cookies?.[OAUTH_NONCE_COOKIE_NAME] as string | undefined;
    const consumed = nonce
      ? await this.oauthStateService.consume(nonce, state)
      : null;
    if (!consumed) {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }

    const redirectUri =
      this.configService.getOrThrow<string>('OAUTH_REDIRECT_URI');
    const tokenSet = await this.identityProvider.exchangeAuthorizationCode({
      code,
      redirectUri,
      codeVerifier: consumed.codeVerifier,
    });
    const principal = await this.identityProvider.verifyToken(
      tokenSet.accessToken,
    );

    const sessionId = randomUUID();
    const expiresAt = Date.now() + tokenSet.expiresIn * 1000;
    const sessionTtlSeconds =
      this.configService.get<number>('SESSION_TTL_SECONDS') ??
      DEFAULT_SESSION_TTL_SECONDS;
    const sessionCookieName =
      this.configService.get<string>('SESSION_COOKIE_NAME') ??
      DEFAULT_SESSION_COOKIE_NAME;

    await this.sessionStore.set(
      `session:${sessionId}`,
      { tokenSet, principal, expiresAt } satisfies ISessionRecord,
      sessionTtlSeconds,
    );

    const sessionCookie = buildSessionCookie(
      sessionId,
      sessionCookieName,
      sessionTtlSeconds,
    );
    res.cookie(sessionCookie.name, sessionCookie.value, sessionCookie.options);

    const nonceClear = clearSessionCookieOptions(OAUTH_NONCE_COOKIE_NAME);
    res.clearCookie(nonceClear.name, nonceClear.options);

    this.logger.log(
      `OAuth session created (sessionId=${sessionId}, sub=${principal.sub})`,
    );

    const successRedirectUrl = this.configService.getOrThrow<string>(
      'OAUTH_SUCCESS_REDIRECT_URL',
    );
    res.redirect(302, successRedirectUrl);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Destroy the caller session, if any' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    const sessionCookieName =
      this.configService.get<string>('SESSION_COOKIE_NAME') ??
      DEFAULT_SESSION_COOKIE_NAME;
    const sessionId = req.cookies?.[sessionCookieName] as string | undefined;

    if (sessionId) {
      this.logger.log(`Logout requested (sessionId=${sessionId})`);
      await this.sessionStore.delete(`session:${sessionId}`);
    } else {
      this.logger.log('Logout requested with no active session');
    }

    const clear = clearSessionCookieOptions(sessionCookieName);
    res.clearCookie(clear.name, clear.options);

    return { success: true };
  }
}
