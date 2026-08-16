import { IIdentityProvider } from '../../application/ports/identity-provider.port';
import { AuthController } from './auth.controller';

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

describe('AuthController', () => {
  it('login() forwards credentials to the active provider', async () => {
    const identityProvider = buildIdentityProvider();
    identityProvider.login.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 3600,
    });
    const controller = new AuthController(identityProvider);

    const result = await controller.login({
      email: 'user@example.com',
      password: 'secret',
    });

    expect(identityProvider.login).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secret',
    });
    expect(result).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 3600,
    });
  });

  it('refresh() forwards the refresh token to the active provider', async () => {
    const identityProvider = buildIdentityProvider();
    identityProvider.refreshToken.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 3600,
    });
    const controller = new AuthController(identityProvider);

    await controller.refresh({ refreshToken: 'refresh-token' });

    expect(identityProvider.refreshToken).toHaveBeenCalledWith('refresh-token');
  });
});
