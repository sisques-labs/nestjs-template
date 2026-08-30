import { ConfigService } from '@nestjs/config';

import { UnsupportedIdentityException } from '@core/identity/application/exceptions/unsupported-identity.exception';
import { IdentityProviderTypeEnum } from '@core/identity/domain/enums/identity-provider-type.enum';
import { IIdentityProviderPort } from '@core/identity/application/ports/identity-provider.port';

/**
 * Resolves the single active `IIdentityProvider` adapter from
 * `IDENTITY_PROVIDER` at boot. Adapters are constructed directly (they only
 * depend on `ConfigService`) rather than through the Nest DI container.
 *
 * Each branch dynamically imports its adapter instead of importing all
 * three at the top of this file: only the selected provider's SDK
 * (`@aws-sdk/client-cognito-identity-provider`, `@supabase/supabase-js`, or
 * `openid-client`/`jose`) is ever loaded, so a service that only uses one
 * provider never pulls the other two SDKs into its module graph.
 */
export async function identityProviderFactory(
  config: ConfigService,
): Promise<IIdentityProviderPort> {
  const provider = config.get<IdentityProviderTypeEnum>('IDENTITY_PROVIDER');

  switch (provider) {
    case IdentityProviderTypeEnum.COGNITO: {
      const { CognitoIdentityProvider } =
        await import('@core/identity/infrastructure/providers/cognito/cognito-identity.provider');
      return new CognitoIdentityProvider(config);
    }
    case IdentityProviderTypeEnum.SUPABASE: {
      const { SupabaseIdentityProvider } =
        await import('@core/identity/infrastructure/providers/supabase/supabase-identity.provider');
      return new SupabaseIdentityProvider(config);
    }
    case IdentityProviderTypeEnum.OIDC: {
      const { OidcIdentityProvider } =
        await import('@core/identity/infrastructure/providers/oidc/oidc-identity.provider');
      return new OidcIdentityProvider(config);
    }
    default:
      throw new UnsupportedIdentityException(String(provider));
  }
}
