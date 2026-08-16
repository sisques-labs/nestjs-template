import { EnumValueObject } from '@sisques-labs/nestjs-kit';

import { CurrencyEnum } from '@contexts/payments/domain/enums/currency.enum';

export class CurrencyValueObject extends EnumValueObject<typeof CurrencyEnum> {
  constructor(value: CurrencyEnum) {
    super(value);
  }

  protected get enumObject(): typeof CurrencyEnum {
    return CurrencyEnum as unknown as typeof CurrencyEnum;
  }
}
