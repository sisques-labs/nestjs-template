import { Request } from 'express';

import { IIdentityProvider } from '../../application/ports/identity-provider.port';
import { IPrincipal } from '../../application/ports/interfaces/principal.interface';
import { IdentityMcpContextBuilder } from './identity-mcp-context-builder.service';

function buildIdentityProvider(): jest.Mocked<IIdentityProvider> {
  return {
    login: jest.fn(),
    refreshToken: jest.fn(),
    verifyToken: jest.fn(),
    getAuthorizationUrl: jest.fn(),
    exchangeAuthorizationCode: jest.fn(),
    createUser: jest.fn(),
    disableUser: jest.fn(),
    deleteUser: jest.fn(),
    updateUserAttributes: jest.fn(),
    resetPassword: jest.fn(),
  };
}

function buildRequest(authorization?: string): Request {
  return { headers: { authorization } } as unknown as Request;
}

describe('IdentityMcpContextBuilder', () => {
  it('returns an empty context when no Authorization header is present', async () => {
    const builder = new IdentityMcpContextBuilder(buildIdentityProvider());

    const context = await builder.build(buildRequest());

    expect(context).toEqual({});
  });

  it('attaches the resolved principal when the token is valid', async () => {
    const identityProvider = buildIdentityProvider();
    const principal: IPrincipal = {
      sub: 'user-123',
      email: 'user@example.com',
      roles: [],
      tenantIds: [],
    };
    identityProvider.verifyToken.mockResolvedValue(principal);
    const builder = new IdentityMcpContextBuilder(identityProvider);

    const context = await builder.build(buildRequest('Bearer valid-token'));

    expect(context).toEqual({ principal });
  });

  it('returns an empty context (no throw) when token verification fails', async () => {
    const identityProvider = buildIdentityProvider();
    identityProvider.verifyToken.mockRejectedValue(new Error('expired'));
    const builder = new IdentityMcpContextBuilder(identityProvider);

    const context = await builder.build(buildRequest('Bearer expired-token'));

    expect(context).toEqual({});
  });
});
