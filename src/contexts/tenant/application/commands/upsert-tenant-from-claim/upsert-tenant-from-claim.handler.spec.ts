import { EventBus } from '@nestjs/cqrs';

import { UpsertTenantFromClaimCommand } from '@contexts/tenant/application/commands/upsert-tenant-from-claim/upsert-tenant-from-claim.command';
import { UpsertTenantFromClaimHandler } from '@contexts/tenant/application/commands/upsert-tenant-from-claim/upsert-tenant-from-claim.handler';
import { FindOrCreateTenantByExternalIdService } from '@contexts/tenant/application/services/write/find-or-create-tenant-by-external-id.service';
import { TenantBuilder } from '@contexts/tenant/domain/builders/tenant.builder';

function buildEventBusMock(): jest.Mocked<EventBus> {
  return {
    publishAll: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<EventBus>;
}

function buildFindOrCreateServiceMock(): jest.Mocked<FindOrCreateTenantByExternalIdService> {
  return {
    execute: jest.fn(),
  } as unknown as jest.Mocked<FindOrCreateTenantByExternalIdService>;
}

describe('UpsertTenantFromClaimHandler', () => {
  let eventBus: jest.Mocked<EventBus>;
  let findOrCreateTenantByExternalIdService: jest.Mocked<FindOrCreateTenantByExternalIdService>;
  let handler: UpsertTenantFromClaimHandler;

  beforeEach(() => {
    eventBus = buildEventBusMock();
    findOrCreateTenantByExternalIdService = buildFindOrCreateServiceMock();
    handler = new UpsertTenantFromClaimHandler(
      eventBus,
      findOrCreateTenantByExternalIdService,
    );
  });

  it('returns the existing tenant id and does not publish events when the service resolves an already-existing tenant', async () => {
    const existing = new TenantBuilder()
      .withId('5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11')
      .withExternalId('idp-tenant-external-id')
      .withCreatedAt(new Date('2026-01-01T00:00:00.000Z'))
      .withUpdatedAt(new Date('2026-01-01T00:00:00.000Z'))
      .build();
    findOrCreateTenantByExternalIdService.execute.mockResolvedValue(existing);

    const command = new UpsertTenantFromClaimCommand({
      externalId: 'idp-tenant-external-id',
    });
    const result = await handler.execute(command);

    expect(findOrCreateTenantByExternalIdService.execute).toHaveBeenCalledWith(
      command.externalId,
    );
    expect(result).toBe(existing.id.value);
    expect(eventBus.publishAll).not.toHaveBeenCalled();
  });

  it('publishes events and returns the new id when the service resolves a newly created tenant', async () => {
    const created = new TenantBuilder()
      .withId('5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a12')
      .withExternalId('new-idp-tenant-external-id')
      .withCreatedAt(new Date('2026-01-01T00:00:00.000Z'))
      .withUpdatedAt(new Date('2026-01-01T00:00:00.000Z'))
      .build();
    created.create();
    findOrCreateTenantByExternalIdService.execute.mockResolvedValue(created);

    const command = new UpsertTenantFromClaimCommand({
      externalId: 'new-idp-tenant-external-id',
    });
    const result = await handler.execute(command);

    expect(result).toBe(created.id.value);
    expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
    expect(created.getUncommittedEvents()).toHaveLength(0);
  });
});
