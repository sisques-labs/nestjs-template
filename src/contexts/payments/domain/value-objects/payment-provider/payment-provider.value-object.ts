import { EnumValueObject } from '@sisques-labs/nestjs-kit';

import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';

export class PaymentProviderValueObject extends EnumValueObject<
  typeof PaymentProviderEnum
> {
  constructor(value: PaymentProviderEnum) {
    super(value);
  }

  protected get enumObject(): typeof PaymentProviderEnum {
    return PaymentProviderEnum as unknown as typeof PaymentProviderEnum;
  }
}
