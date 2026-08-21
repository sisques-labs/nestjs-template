import { ConfigService } from '@nestjs/config';

import { IdentityProviderType } from '../../domain/enums/identity-provider-type.enum';
import { IIdentityProvider } from '../ports/identity-provider.port';

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
): Promise<IIdentityProvider> {
  const provider = config.get<IdentityProviderType>('IDENTITY_PROVIDER');

  switch (provider) {
    case IdentityProviderType.COGNITO: {
      const { CognitoIdentityProvider } =
        await import('../../infrastructure/providers/cognito/cognito-identity.provider');
      return new CognitoIdentityProvider(config);
    }
    case IdentityProviderType.SUPABASE: {
      const { SupabaseIdentityProvider } =
        await import('../../infrastructure/providers/supabase/supabase-identity.provider');
      return new SupabaseIdentityProvider(config);
    }
    case IdentityProviderType.OIDC: {
      const { OidcIdentityProvider } =
        await import('../../infrastructure/providers/oidc/oidc-identity.provider');
      return new OidcIdentityProvider(config);
    }
    default:
      throw new Error(
        `Unsupported IDENTITY_PROVIDER "${String(provider)}". Supported values: ${Object.values(IdentityProviderType).join(', ')}.`,
      );
  }
}
