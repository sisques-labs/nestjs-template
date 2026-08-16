import { EnumValueObject } from '@sisques-labs/nestjs-kit';

import { SubscriptionStatusEnum } from '@contexts/payments/domain/enums/subscription-status.enum';

export class SubscriptionStatusValueObject extends EnumValueObject<
  typeof SubscriptionStatusEnum
> {
  constructor(value: SubscriptionStatusEnum) {
    super(value);
  }

  protected get enumObject(): typeof SubscriptionStatusEnum {
    return SubscriptionStatusEnum as unknown as typeof SubscriptionStatusEnum;
  }
}
