import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';

import {
  IDENTITY_PROVIDER,
  IIdentityProvider,
} from '../../application/ports/identity-provider.port';
import { IPrincipal } from '../../application/ports/principal.interface';
import { REQUEST_PRINCIPAL_KEY } from './request-principal.constant';

/**
 * Verifies the request's `Authorization: Bearer <token>` header against the
 * active `IIdentityProvider` and attaches the resolved `IPrincipal` to the
 * request for `@CurrentUser()` / `RolesGuard` to read. Works for both REST
 * and GraphQL execution contexts.
 */
@Injectable()
export class IdentityGuard implements CanActivate {
  constructor(
    @Inject(IDENTITY_PROVIDER)
    private readonly identityProvider: IIdentityProvider,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequest(context);
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const principal = await this.identityProvider.verifyToken(token);
    setPrincipal(request, principal);
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
