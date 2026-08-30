import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

import { IAuthorizationCodeExchange } from '../../../application/ports/interfaces/authorization-code-exchange.interface';
import { IAuthorizationUrlOptions } from '../../../application/ports/interfaces/authorization-url-options.interface';
import { IIdentityProvider } from '../../../application/ports/identity-provider.port';
import { ILoginCredentials } from '../../../application/ports/interfaces/login-credentials.interface';
import { IPrincipal } from '../../../application/ports/interfaces/principal.interface';
import { ITokenSet } from '../../../application/ports/interfaces/token-set.interface';
import { IUserAttributes } from '../../../application/ports/interfaces/user-attributes.interface';
import { mapSupabaseClaimsToPrincipal } from './supabase-claims.mapper';

/**
 * Bridges `IIdentityProvider` to Supabase Auth (GoTrue). Supabase has no
 * native "disable user" operation, so `disableUser` bans the account for a
 * very long duration (`ban_duration`) instead — see `disableUser` below.
 */
@Injectable()
export class SupabaseIdentityProvider implements IIdentityProvider {
  private readonly logger = new Logger(SupabaseIdentityProvider.name);
  private readonly client: SupabaseClient;
  private readonly jwtSecret: Uint8Array;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('SUPABASE_URL');
    const serviceRoleKey = config.getOrThrow<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    this.jwtSecret = new TextEncoder().encode(
      config.getOrThrow<string>('SUPABASE_JWT_SECRET'),
    );
    this.client = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async login(credentials: ILoginCredentials): Promise<ITokenSet> {
    this.logger.log('Login requested (Supabase)');
    const { data, error } = await this.client.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    if (error || !data.session) {
      throw new UnauthorizedException(error?.message ?? 'Login failed');
    }
    return this.toTokenSet(data.session);
  }

  async refreshToken(refreshToken: string): Promise<ITokenSet> {
    this.logger.log('Token refresh requested (Supabase)');
    const { data, error } = await this.client.auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (error || !data.session) {
      throw new UnauthorizedException(error?.message ?? 'Token refresh failed');
    }
    return this.toTokenSet(data.session);
  }

  async verifyToken(accessToken: string): Promise<IPrincipal> {
    try {
      const { payload } = await jwtVerify(accessToken, this.jwtSecret);
      return mapSupabaseClaimsToPrincipal(payload);
    } catch (error) {
      this.logger.warn(
        `Supabase token verification failed: ${(error as Error).message}`,
      );
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  async createUser(attributes: IUserAttributes): Promise<string> {
    this.logger.log(`Creating user (Supabase): ${attributes.email}`);
    const { data, error } = await this.client.auth.admin.createUser({
      email: attributes.email,
      email_confirm: attributes.emailVerified,
      app_metadata: { roles: attributes.roles },
      user_metadata: attributes.metadata,
    });
    if (error || !data.user) {
      throw new Error(error?.message ?? 'Failed to create Supabase user');
    }
    return data.user.id;
  }

  /**
   * Supabase Auth has no "disable" concept — banning for a very long
   * duration is the documented workaround
   * (https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid).
   */
  async disableUser(userId: string): Promise<void> {
    this.logger.log(`Disabling user (Supabase): ${userId}`);
    const { error } = await this.client.auth.admin.updateUserById(userId, {
      ban_duration: '876000h',
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  async deleteUser(userId: string): Promise<void> {
    this.logger.log(`Deleting user (Supabase): ${userId}`);
    const { error } = await this.client.auth.admin.deleteUser(userId);
    if (error) {
      throw new Error(error.message);
    }
  }

  async updateUserAttributes(
    userId: string,
    attributes: Partial<IUserAttributes>,
  ): Promise<void> {
    this.logger.log(`Updating attributes (Supabase): ${userId}`);
    const { error } = await this.client.auth.admin.updateUserById(userId, {
      email: attributes.email,
      app_metadata: attributes.roles ? { roles: attributes.roles } : undefined,
      user_metadata: attributes.metadata,
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  async resetPassword(userId: string): Promise<void> {
    this.logger.log(`Triggering password reset (Supabase): ${userId}`);
    const { data: userData, error: getUserError } =
      await this.client.auth.admin.getUserById(userId);
    if (getUserError || !userData.user?.email) {
      throw new Error(getUserError?.message ?? 'User not found');
    }
    const { error } = await this.client.auth.admin.generateLink({
      type: 'recovery',
      email: userData.user.email,
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  async getAuthorizationUrl(
    options: IAuthorizationUrlOptions,
  ): Promise<string> {
    this.logger.log('Authorization URL requested (Supabase)');
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: options.redirectUri,
        skipBrowserRedirect: true,
        queryParams: { state: options.state },
      },
    });
    if (error) {
      throw new UnauthorizedException(error.message);
    }
    return data.url;
  }

  async exchangeAuthorizationCode(
    options: IAuthorizationCodeExchange,
  ): Promise<ITokenSet> {
    this.logger.log('Authorization code exchange requested (Supabase)');
    const { data, error } = await this.client.auth.exchangeCodeForSession(
      options.code,
    );
    if (error || !data.session) {
      throw new UnauthorizedException(
        error?.message ?? 'Authorization code exchange failed',
      );
    }
    return this.toTokenSet(data.session);
  }

  private toTokenSet(session: {
    access_token: string;
    refresh_token: string | null;
    expires_in: number;
  }): ITokenSet {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
    };
  }
}
