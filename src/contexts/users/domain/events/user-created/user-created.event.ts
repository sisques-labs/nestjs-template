import { BaseEvent, IEventMetadata } from '@sisques-labs/nestjs-kit';

import { IUserEventData } from '@contexts/users/domain/events/interfaces/user-event-data.interface';

/**
 * Emitted exclusively by `UserAggregate.create()`, the first time a `User`
 * row is created for a given `(tenantId, externalId)` pair. `rename()` and
 * `syncEmail()` — the aggregate's other mutating methods — deliberately do
 * not emit events; see `user-profile` spec, only creation is one.
 */
export class UserCreatedEvent extends BaseEvent<IUserEventData> {
  constructor(metadata: IEventMetadata, data: IUserEventData) {
    super(metadata, data);
  }
}
