import { ConfigService } from '@nestjs/config';

jest.mock(
  '../../infrastructure/providers/cognito/cognito-identity.provider',
  () => ({ CognitoIdentityProvider: jest.fn() }),
);
jest.mock(
  '../../infrastructure/providers/supabase/supabase-identity.provider',
  () => ({ SupabaseIdentityProvider: jest.fn() }),
);
jest.mock('../../infrastructure/providers/oidc/oidc-identity.provider', () => ({
  OidcIdentityProvider: jest.fn(),
}));

import { IdentityProviderType } from '../../domain/enums/identity-provider-type.enum';
import { CognitoIdentityProvider } from '../../infrastructure/providers/cognito/cognito-identity.provider';
import { OidcIdentityProvider } from '../../infrastructure/providers/oidc/oidc-identity.provider';
import { SupabaseIdentityProvider } from '../../infrastructure/providers/supabase/supabase-identity.provider';
import { identityProviderFactory } from './identity-provider.factory';

function buildConfig(
  provider: IdentityProviderType | string | undefined,
): jest.Mocked<ConfigService> {
  return {
    get: jest.fn().mockReturnValue(provider),
  } as unknown as jest.Mocked<ConfigService>;
}

describe('identityProviderFactory', () => {
  it('returns a CognitoIdentityProvider for "cognito"', async () => {
    const provider = await identityProviderFactory(
      buildConfig(IdentityProviderType.COGNITO),
    );

    expect(provider).toBeInstanceOf(CognitoIdentityProvider);
  });

  it('returns a SupabaseIdentityProvider for "supabase"', async () => {
    const provider = await identityProviderFactory(
      buildConfig(IdentityProviderType.SUPABASE),
    );

    expect(provider).toBeInstanceOf(SupabaseIdentityProvider);
  });

  it('returns an OidcIdentityProvider for "oidc"', async () => {
    const provider = await identityProviderFactory(
      buildConfig(IdentityProviderType.OIDC),
    );

    expect(provider).toBeInstanceOf(OidcIdentityProvider);
  });

  it('throws for an unsupported provider value', async () => {
    await expect(identityProviderFactory(buildConfig('okta'))).rejects.toThrow(
      /Unsupported IDENTITY_PROVIDER "okta"/,
    );
  });

  it('throws when no provider is configured', async () => {
    await expect(
      identityProviderFactory(buildConfig(undefined)),
    ).rejects.toThrow(/Unsupported IDENTITY_PROVIDER "undefined"/);
  });
});
