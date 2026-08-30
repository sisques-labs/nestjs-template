import { IdentityProviderTypeEnum } from '@core/identity/domain/enums/identity-provider-type.enum';

export class UnsupportedIdentityException extends Error {
  constructor(provider: string) {
    super(
      `Unsupported IDENTITY_PROVIDER "${provider}". Supported values: ${Object.values(IdentityProviderTypeEnum).join(', ')}.`,
    );
  }
}
