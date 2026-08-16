import { BaseEvent, IEventMetadata } from '@sisques-labs/nestjs-kit';

import { ISubscriptionEventData } from '@contexts/payments/domain/events/interfaces/subscription-event-data.interface';

export class SubscriptionStatusChangedEvent extends BaseEvent<ISubscriptionEventData> {
  constructor(metadata: IEventMetadata, data: ISubscriptionEventData) {
    super(metadata, data);
  }
}
