import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IBaseMcpToolContext,
  IMcpContextBuilder,
} from '@sisques-labs/nestjs-kit/mcp';
import { Request } from 'express';

import {
  IDENTITY_PROVIDER,
  IIdentityProvider,
} from '../../application/ports/identity-provider.port';
import { IPrincipal } from '../../application/ports/principal.interface';
import { extractBearerToken } from '../extract-bearer-token';

export interface IIdentityMcpToolContext extends IBaseMcpToolContext {
  principal?: IPrincipal;
}

/**
 * Resolves an `IPrincipal` from the MCP request's bearer token (mirroring
 * `IdentityGuard`) and attaches it to `IMcpToolContext`. Never rejects the
 * request itself: a missing or invalid token just means the context has no
 * `principal` — requiring one is left to individual tools, none of which
 * exist yet in this template.
 */
@Injectable()
export class IdentityMcpContextBuilder implements IMcpContextBuilder<IIdentityMcpToolContext> {
  private readonly logger = new Logger(IdentityMcpContextBuilder.name);

  constructor(
    @Inject(IDENTITY_PROVIDER)
    private readonly identityProvider: IIdentityProvider,
  ) {}

  async build(req: Request): Promise<IIdentityMcpToolContext> {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return {};
    }

    try {
      const principal = await this.identityProvider.verifyToken(token);
      return { principal };
    } catch (error) {
      this.logger.warn(
        `MCP request bearer token failed verification: ${(error as Error).message}`,
      );
      return {};
    }
  }
}
