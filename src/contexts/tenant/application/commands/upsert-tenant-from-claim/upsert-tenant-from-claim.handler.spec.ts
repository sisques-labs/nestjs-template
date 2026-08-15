import { EventBus } from '@nestjs/cqrs';

import { UpsertTenantFromClaimCommand } from '@contexts/tenant/application/commands/upsert-tenant-from-claim/upsert-tenant-from-claim.command';
import { UpsertTenantFromClaimHandler } from '@contexts/tenant/application/commands/upsert-tenant-from-claim/upsert-tenant-from-claim.handler';
import { TenantAggregate } from '@contexts/tenant/domain/aggregates/tenant.aggregate';
import { TenantBuilder } from '@contexts/tenant/domain/builders/tenant.builder';
import { ITenantWriteRepository } from '@contexts/tenant/domain/repositories/write/tenant-write.repository';

function buildEventBusMock(): jest.Mocked<EventBus> {
  return {
    publishAll: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<EventBus>;
}

function buildWriteRepositoryMock(): jest.Mocked<ITenantWriteRepository> {
  return {
    findById: jest.fn(),
    findByCriteria: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    findByExternalId: jest.fn(),
  };
}

describe('UpsertTenantFromClaimHandler', () => {
  let eventBus: jest.Mocked<EventBus>;
  let tenantWriteRepository: jest.Mocked<ITenantWriteRepository>;
  let handler: UpsertTenantFromClaimHandler;

  beforeEach(() => {
    eventBus = buildEventBusMock();
    tenantWriteRepository = buildWriteRepositoryMock();
    handler = new UpsertTenantFromClaimHandler(eventBus, tenantWriteRepository);
  });

  it('returns the existing tenant id and does not write when one already exists for the externalId', async () => {
    const existing = new TenantBuilder()
      .withId('5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11')
      .withExternalId('idp-tenant-external-id')
      .withCreatedAt(new Date('2026-01-01T00:00:00.000Z'))
      .withUpdatedAt(new Date('2026-01-01T00:00:00.000Z'))
      .build();
    tenantWriteRepository.findByExternalId.mockResolvedValue(existing);

    const command = new UpsertTenantFromClaimCommand({
      externalId: 'idp-tenant-external-id',
    });
    const result = await handler.execute(command);

    expect(result).toBe(existing.id.value);
    expect(tenantWriteRepository.save).not.toHaveBeenCalled();
    expect(eventBus.publishAll).not.toHaveBeenCalled();
  });

  it('creates a new tenant, persists it, publishes its events, and returns the new id when none exists', async () => {
    tenantWriteRepository.findByExternalId.mockResolvedValue(null);
    tenantWriteRepository.save.mockImplementation(
      (aggregate: TenantAggregate) => Promise.resolve(aggregate),
    );

    const command = new UpsertTenantFromClaimCommand({
      externalId: 'new-idp-tenant-external-id',
    });
    const result = await handler.execute(command);

    expect(tenantWriteRepository.save).toHaveBeenCalledTimes(1);
    const savedAggregate = tenantWriteRepository.save.mock
      .calls[0][0] as TenantAggregate;
    expect(savedAggregate.externalId.value).toBe('new-idp-tenant-external-id');
    expect(result).toBe(savedAggregate.id.value);
    expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
    expect(savedAggregate.getUncommittedEvents()).toHaveLength(0);
  });
});
