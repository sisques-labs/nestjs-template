import { BaseEvent, IEventMetadata } from '@sisques-labs/nestjs-kit';

import { IPaymentEventData } from '@contexts/payments/domain/events/interfaces/payment-event-data.interface';

export class PaymentFailedEvent extends BaseEvent<IPaymentEventData> {
  constructor(metadata: IEventMetadata, data: IPaymentEventData) {
    super(metadata, data);
  }
}
