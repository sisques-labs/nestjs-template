import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { IIdentityProvider } from '../../application/ports/identity-provider.port';
import { IPrincipal } from '../../application/ports/principal.interface';
import { getPrincipal, IdentityGuard } from './identity.guard';

function buildHttpContext(headers: Record<string, string> = {}): {
  context: ExecutionContext;
  request: { headers: Record<string, string> };
} {
  const request: { headers: Record<string, string> } = { headers };
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

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
  };
}

describe('IdentityGuard', () => {
  it('rejects a request with no Authorization header', async () => {
    const { context } = buildHttpContext();
    const guard = new IdentityGuard(buildIdentityProvider());

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a non-Bearer Authorization header', async () => {
    const { context } = buildHttpContext({ authorization: 'Basic abc123' });
    const guard = new IdentityGuard(buildIdentityProvider());

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an empty Bearer token', async () => {
    const { context } = buildHttpContext({ authorization: 'Bearer   ' });
    const guard = new IdentityGuard(buildIdentityProvider());

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('attaches the resolved principal to the request and allows the request', async () => {
    const { context, request } = buildHttpContext({
      authorization: 'Bearer valid-token',
    });
    const identityProvider = buildIdentityProvider();
    const principal: IPrincipal = {
      sub: 'user-123',
      email: 'user@example.com',
      roles: [],
      tenantId: null,
    };
    identityProvider.verifyToken.mockResolvedValue(principal);
    const guard = new IdentityGuard(identityProvider);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(identityProvider.verifyToken).toHaveBeenCalledWith('valid-token');
    expect(getPrincipal(request as never)).toEqual(principal);
  });

  it('propagates the provider rejection for an invalid token', async () => {
    const { context } = buildHttpContext({
      authorization: 'Bearer expired-token',
    });
    const identityProvider = buildIdentityProvider();
    identityProvider.verifyToken.mockRejectedValue(
      new UnauthorizedException('Invalid or expired access token'),
    );
    const guard = new IdentityGuard(identityProvider);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('reads the request from the GraphQL context when the execution type is graphql', async () => {
    const request = { headers: { authorization: 'Bearer valid-token' } };
    // GqlExecutionContext.create() normalizes context.getArgs() into
    // [root, args, context, info] and reads the request off index 2.
    const context = {
      getType: () => 'graphql',
      getArgs: () => [undefined, undefined, { req: request }, undefined],
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;

    const identityProvider = buildIdentityProvider();
    identityProvider.verifyToken.mockResolvedValue({
      sub: 'user-123',
      email: null,
      roles: [],
      tenantId: null,
    });
    const guard = new IdentityGuard(identityProvider);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });
});
