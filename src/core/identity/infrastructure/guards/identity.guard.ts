import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';

import {
  IDENTITY_PROVIDER,
  IIdentityProvider,
} from '../../application/ports/identity-provider.port';
import { IPrincipal } from '../../application/ports/principal.interface';
import { ISessionRecord } from '../../application/ports/session-record.interface';
import {
  ISessionStore,
  SESSION_STORE,
} from '../../application/ports/session-store.port';
import { REQUEST_PRINCIPAL_KEY } from './request-principal.constant';

const DEFAULT_SESSION_COOKIE_NAME = 'session';
const DEFAULT_SESSION_TTL_SECONDS = 86400;

/**
 * Resolves the request's `IPrincipal`, trying an OAuth/BFF session cookie
 * first and falling back to the `Authorization: Bearer <token>` header.
 * Both paths attach the same `IPrincipal` shape — `@CurrentUser()` /
 * `RolesGuard` don't know or care which one resolved it. Works for both
 * REST and GraphQL execution contexts.
 *
 * `sessionStore` is `@Optional()` because `SESSION_STORE` is only provided
 * by `identity.module.ts` when `OAUTH_SESSION_ENABLED=true` — this guard
 * must keep working bearer-only when the feature is off.
 */
@Injectable()
export class IdentityGuard implements CanActivate {
  constructor(
    @Inject(IDENTITY_PROVIDER)
    private readonly identityProvider: IIdentityProvider,
    @Optional()
    @Inject(SESSION_STORE)
    private readonly sessionStore: ISessionStore | undefined,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequest(context);

    if (this.sessionStore) {
      const cookieName =
        this.configService.get<string>('SESSION_COOKIE_NAME') ??
        DEFAULT_SESSION_COOKIE_NAME;
      const sessionId = request.cookies?.[cookieName] as string | undefined;
      if (sessionId) {
        return this.resolveFromSession(request, sessionId);
      }
    }

    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const principal = await this.identityProvider.verifyToken(token);
    setPrincipal(request, principal);
    return true;
  }

  private async resolveFromSession(
    request: Request,
    sessionId: string,
  ): Promise<boolean> {
    const key = `session:${sessionId}`;
    const record = await this.sessionStore!.get<ISessionRecord>(key);
    if (!record) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    if (Date.now() >= record.expiresAt) {
      return this.refreshSession(request, key, record);
    }

    setPrincipal(request, record.principal);
    return true;
  }

  private async refreshSession(
    request: Request,
    key: string,
    record: ISessionRecord,
  ): Promise<boolean> {
    const refreshToken = record.tokenSet.refreshToken;
    if (!refreshToken) {
      await this.sessionStore!.delete(key);
      throw new UnauthorizedException('Session refresh failed');
    }

    let newTokenSet;
    try {
      newTokenSet = await this.identityProvider.refreshToken(refreshToken);
    } catch {
      await this.sessionStore!.delete(key);
      throw new UnauthorizedException('Session refresh failed');
    }

    const newExpiresAt = Date.now() + newTokenSet.expiresIn * 1000;
    const sessionTtlSeconds =
      this.configService.get<number>('SESSION_TTL_SECONDS') ??
      DEFAULT_SESSION_TTL_SECONDS;
    await this.sessionStore!.set(
      key,
      {
        tokenSet: newTokenSet,
        principal: record.principal,
        expiresAt: newExpiresAt,
      } satisfies ISessionRecord,
      sessionTtlSeconds,
    );

    setPrincipal(request, record.principal);
    return true;
  }
}

export function getRequest(context: ExecutionContext): Request {
  if (context.getType<'http' | 'graphql'>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<{ req: Request }>()
      .req;
  }
  return context.switchToHttp().getRequest<Request>();
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

function setPrincipal(request: Request, principal: IPrincipal): void {
  (request as Request & { [REQUEST_PRINCIPAL_KEY]?: IPrincipal })[
    REQUEST_PRINCIPAL_KEY
  ] = principal;
}

export function getPrincipal(request: Request): IPrincipal | undefined {
  return (request as Request & { [REQUEST_PRINCIPAL_KEY]?: IPrincipal })[
    REQUEST_PRINCIPAL_KEY
  ];
}
