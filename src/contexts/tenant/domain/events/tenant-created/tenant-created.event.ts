import { BaseEvent, IEventMetadata } from '@sisques-labs/nestjs-kit';

import { ITenantEventData } from '@contexts/tenant/domain/events/interfaces/tenant-event-data.interface';

/**
 * Emitted exclusively by `TenantAggregate.create()`, the first (and only,
 * in v1) time a `Tenant` row is created for a given `externalId`.
 */
export class TenantCreatedEvent extends BaseEvent<ITenantEventData> {
  constructor(metadata: IEventMetadata, data: ITenantEventData) {
    super(metadata, data);
  }
}
