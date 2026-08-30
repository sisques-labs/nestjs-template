import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminInitiateAuthCommand,
  AdminResetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  AttributeType,
  AuthFlowType,
  AuthenticationResultType,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import { IAuthorizationCodeExchange } from '@core/identity/application/interfaces/authorization-code-exchange.interface';
import { IAuthorizationUrlOptions } from '@core/identity/application/interfaces/authorization-url-options.interface';
import { IIdentityProvider } from '@core/identity/application/ports/identity-provider.port';
import { ILoginCredentials } from '@core/identity/application/interfaces/login-credentials.interface';
import { IPrincipal } from '@core/identity/application/interfaces/principal.interface';
import { ITokenSet } from '@core/identity/application/interfaces/token-set.interface';
import { IUserAttributes } from '@core/identity/application/interfaces/user-attributes.interface';
import { mapCognitoClaimsToPrincipal } from './cognito-claims.mapper';

/** Bridges `IIdentityProvider` to an AWS Cognito User Pool. */
@Injectable()
export class CognitoIdentityProvider implements IIdentityProvider {
  private readonly logger = new Logger(CognitoIdentityProvider.name);
  private readonly client: CognitoIdentityProviderClient;
  private readonly userPoolId: string;
  private readonly clientId: string;
  private readonly issuer: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly hostedUiDomain: string;

  constructor(config: ConfigService) {
    const region = config.getOrThrow<string>('COGNITO_REGION');
    this.userPoolId = config.getOrThrow<string>('COGNITO_USER_POOL_ID');
    this.clientId = config.getOrThrow<string>('COGNITO_CLIENT_ID');
    this.hostedUiDomain = config.getOrThrow<string>('COGNITO_HOSTED_UI_DOMAIN');
    this.client = new CognitoIdentityProviderClient({ region });
    this.issuer = `https://cognito-idp.${region}.amazonaws.com/${this.userPoolId}`;
    this.jwks = createRemoteJWKSet(
      new URL(`${this.issuer}/.well-known/jwks.json`),
    );
  }

  async login(credentials: ILoginCredentials): Promise<ITokenSet> {
    this.logger.log('Login requested (Cognito)');
    const result = await this.client.send(
      new AdminInitiateAuthCommand({
        UserPoolId: this.userPoolId,
        ClientId: this.clientId,
        AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
        AuthParameters: {
          USERNAME: credentials.email,
          PASSWORD: credentials.password,
        },
      }),
    );
    return this.toTokenSet(result.AuthenticationResult);
  }

  async refreshToken(refreshToken: string): Promise<ITokenSet> {
    this.logger.log('Token refresh requested (Cognito)');
    const result = await this.client.send(
      new AdminInitiateAuthCommand({
        UserPoolId: this.userPoolId,
        ClientId: this.clientId,
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      }),
    );
    return this.toTokenSet(result.AuthenticationResult, refreshToken);
  }

  async verifyToken(accessToken: string): Promise<IPrincipal> {
    try {
      const { payload } = await jwtVerify(accessToken, this.jwks, {
        issuer: this.issuer,
      });
      if (
        payload.token_use !== 'access' ||
        payload.client_id !== this.clientId
      ) {
        throw new Error(
          'Token is not a Cognito access token for this app client',
        );
      }
      return mapCognitoClaimsToPrincipal(payload);
    } catch (error) {
      this.logger.warn(
        `Cognito token verification failed: ${(error as Error).message}`,
      );
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  async createUser(attributes: IUserAttributes): Promise<string> {
    this.logger.log(`Creating user (Cognito): ${attributes.email}`);
    const result = await this.client.send(
      new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: attributes.email,
        UserAttributes: [
          { Name: 'email', Value: attributes.email },
          {
            Name: 'email_verified',
            Value: attributes.emailVerified ? 'true' : 'false',
          },
        ],
      }),
    );
    const sub = result.User?.Attributes?.find(
      (attribute) => attribute.Name === 'sub',
    )?.Value;
    return sub ?? result.User?.Username ?? attributes.email;
  }

  async disableUser(userId: string): Promise<void> {
    this.logger.log(`Disabling user (Cognito): ${userId}`);
    await this.client.send(
      new AdminDisableUserCommand({
        UserPoolId: this.userPoolId,
        Username: userId,
      }),
    );
  }

  async deleteUser(userId: string): Promise<void> {
    this.logger.log(`Deleting user (Cognito): ${userId}`);
    await this.client.send(
      new AdminDeleteUserCommand({
        UserPoolId: this.userPoolId,
        Username: userId,
      }),
    );
  }

  async updateUserAttributes(
    userId: string,
    attributes: Partial<IUserAttributes>,
  ): Promise<void> {
    this.logger.log(`Updating attributes (Cognito): ${userId}`);
    const userAttributes: AttributeType[] = [];
    if (attributes.email !== undefined) {
      userAttributes.push({ Name: 'email', Value: attributes.email });
    }
    if (attributes.emailVerified !== undefined) {
      userAttributes.push({
        Name: 'email_verified',
        Value: attributes.emailVerified ? 'true' : 'false',
      });
    }
    if (userAttributes.length === 0) {
      return;
    }
    await this.client.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: userId,
        UserAttributes: userAttributes,
      }),
    );
  }

  async resetPassword(userId: string): Promise<void> {
    this.logger.log(`Triggering password reset (Cognito): ${userId}`);
    await this.client.send(
      new AdminResetUserPasswordCommand({
        UserPoolId: this.userPoolId,
        Username: userId,
      }),
    );
  }

  async getAuthorizationUrl(
    options: IAuthorizationUrlOptions,
  ): Promise<string> {
    this.logger.log('Authorization URL requested (Cognito)');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: options.redirectUri,
      state: options.state,
      code_challenge: options.codeChallenge,
      code_challenge_method: 'S256',
      scope: 'openid profile email',
    });
    return `https://${this.hostedUiDomain}/oauth2/authorize?${params.toString()}`;
  }

  async exchangeAuthorizationCode(
    options: IAuthorizationCodeExchange,
  ): Promise<ITokenSet> {
    this.logger.log('Authorization code exchange requested (Cognito)');
    const response = await fetch(
      `https://${this.hostedUiDomain}/oauth2/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          code: options.code,
          redirect_uri: options.redirectUri,
          code_verifier: options.codeVerifier,
        }),
      },
    );
    if (!response.ok) {
      this.logger.warn(
        `Cognito authorization code exchange failed: ${response.status} ${response.statusText}`,
      );
      throw new UnauthorizedException(
        'Failed to exchange authorization code with Cognito',
      );
    }
    const body = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? null,
      expiresIn: body.expires_in ?? 3600,
    };
  }

  private toTokenSet(
    result: AuthenticationResultType | undefined,
    fallbackRefreshToken?: string,
  ): ITokenSet {
    if (!result?.AccessToken) {
      throw new UnauthorizedException('Cognito did not return an access token');
    }
    return {
      accessToken: result.AccessToken,
      refreshToken: result.RefreshToken ?? fallbackRefreshToken ?? null,
      expiresIn: result.ExpiresIn ?? 3600,
    };
  }
}
