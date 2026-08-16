import { EnumValueObject } from '@sisques-labs/nestjs-kit';

import { PaymentStatusEnum } from '@contexts/payments/domain/enums/payment-status.enum';

export class PaymentStatusValueObject extends EnumValueObject<
  typeof PaymentStatusEnum
> {
  constructor(value: PaymentStatusEnum) {
    super(value);
  }

  protected get enumObject(): typeof PaymentStatusEnum {
    return PaymentStatusEnum as unknown as typeof PaymentStatusEnum;
  }
}
