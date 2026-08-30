import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import * as client from 'openid-client';

import { IAuthorizationCodeExchange } from '@core/identity/application/interfaces/authorization-code-exchange.interface';
import { IAuthorizationUrlOptions } from '@core/identity/application/interfaces/authorization-url-options.interface';
import { IIdentityProvider } from '@core/identity/application/ports/identity-provider.port';
import { ILoginCredentials } from '@core/identity/application/interfaces/login-credentials.interface';
import { IPrincipal } from '@core/identity/application/interfaces/principal.interface';
import { ITokenSet } from '@core/identity/application/interfaces/token-set.interface';
import { IUserAttributes } from '@core/identity/application/interfaces/user-attributes.interface';
import { mapOidcClaimsToPrincipal } from './oidc-claims.mapper';

const OIDC_ADMIN_API_ERROR =
  "not supported by the generic OIDC adapter — OIDC has no standard admin API. Use a provider-specific adapter (Cognito/Supabase) or your IdP's native admin tooling.";

/**
 * Bridges `IIdentityProvider` to any OIDC-compliant IdP resolved via
 * discovery (Auth0, Firebase, Keycloak, ...). `login`/`refreshToken` use the
 * Resource Owner Password Credentials grant (RFC 6749 §4.3) — not part of
 * the OIDC core spec, but the only grant type that fits a backend-proxied
 * login without a redirect flow, and widely supported by first-party
 * OIDC/OAuth2 servers. User-management methods are unsupported: OIDC
 * defines no standard admin API surface.
 */
@Injectable()
export class OidcIdentityProvider implements IIdentityProvider {
  private readonly logger = new Logger(OidcIdentityProvider.name);
  private readonly issuerUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly roleClaim: string;
  private configuration: Promise<client.Configuration> | null = null;
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(config: ConfigService) {
    this.issuerUrl = config.getOrThrow<string>('OIDC_ISSUER_URL');
    this.clientId = config.getOrThrow<string>('OIDC_CLIENT_ID');
    this.clientSecret = config.getOrThrow<string>('OIDC_CLIENT_SECRET');
    this.roleClaim = config.get<string>('OIDC_ROLE_CLAIM') ?? 'roles';
  }

  async login(credentials: ILoginCredentials): Promise<ITokenSet> {
    this.logger.log('Login requested (OIDC)');
    const configuration = await this.getConfiguration();
    const tokens = await client.genericGrantRequest(
      configuration,
      'password',
      new URLSearchParams({
        username: credentials.email,
        password: credentials.password,
        scope: 'openid profile email',
      }),
    );
    return this.toTokenSet(tokens);
  }

  async refreshToken(refreshToken: string): Promise<ITokenSet> {
    this.logger.log('Token refresh requested (OIDC)');
    const configuration = await this.getConfiguration();
    const tokens = await client.refreshTokenGrant(configuration, refreshToken);
    return this.toTokenSet(tokens, refreshToken);
  }

  async verifyToken(accessToken: string): Promise<IPrincipal> {
    try {
      const configuration = await this.getConfiguration();
      const jwks = await this.getJwks();
      const { issuer } = configuration.serverMetadata();
      const { payload } = await jwtVerify(accessToken, jwks, { issuer });
      return mapOidcClaimsToPrincipal(payload, this.roleClaim);
    } catch (error) {
      this.logger.warn(
        `OIDC token verification failed: ${(error as Error).message}`,
      );
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  async getAuthorizationUrl(
    options: IAuthorizationUrlOptions,
  ): Promise<string> {
    this.logger.log('Authorization URL requested (OIDC)');
    const configuration = await this.getConfiguration();
    return client.buildAuthorizationUrl(configuration, {
      redirect_uri: options.redirectUri,
      scope: 'openid profile email',
      state: options.state,
      code_challenge: options.codeChallenge,
      code_challenge_method: 'S256',
    }).href;
  }

  async exchangeAuthorizationCode(
    options: IAuthorizationCodeExchange,
  ): Promise<ITokenSet> {
    this.logger.log('Authorization code exchange requested (OIDC)');
    const configuration = await this.getConfiguration();
    const tokens = await client.authorizationCodeGrant(
      configuration,
      new URL(
        `${options.redirectUri}?code=${encodeURIComponent(options.code)}`,
      ),
      {
        pkceCodeVerifier: options.codeVerifier,
        expectedState: client.skipStateCheck,
      },
    );
    return this.toTokenSet(tokens);
  }

  createUser(_attributes: IUserAttributes): Promise<string> {
    return Promise.reject(new Error(`createUser is ${OIDC_ADMIN_API_ERROR}`));
  }

  disableUser(_userId: string): Promise<void> {
    return Promise.reject(new Error(`disableUser is ${OIDC_ADMIN_API_ERROR}`));
  }

  deleteUser(_userId: string): Promise<void> {
    return Promise.reject(new Error(`deleteUser is ${OIDC_ADMIN_API_ERROR}`));
  }

  updateUserAttributes(
    _userId: string,
    _attributes: Partial<IUserAttributes>,
  ): Promise<void> {
    return Promise.reject(
      new Error(`updateUserAttributes is ${OIDC_ADMIN_API_ERROR}`),
    );
  }

  resetPassword(_userId: string): Promise<void> {
    return Promise.reject(
      new Error(`resetPassword is ${OIDC_ADMIN_API_ERROR}`),
    );
  }

  private getConfiguration(): Promise<client.Configuration> {
    this.configuration ??= client.discovery(
      new URL(this.issuerUrl),
      this.clientId,
      this.clientSecret,
    );
    return this.configuration;
  }

  private async getJwks(): Promise<ReturnType<typeof createRemoteJWKSet>> {
    if (!this.jwks) {
      const configuration = await this.getConfiguration();
      const { jwks_uri: jwksUri } = configuration.serverMetadata();
      if (!jwksUri) {
        throw new Error('OIDC issuer did not advertise a jwks_uri');
      }
      this.jwks = createRemoteJWKSet(new URL(jwksUri));
    }
    return this.jwks;
  }

  private toTokenSet(
    tokens: {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    },
    fallbackRefreshToken?: string,
  ): ITokenSet {
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? fallbackRefreshToken ?? null,
      expiresIn: tokens.expires_in ?? 3600,
    };
  }
}
