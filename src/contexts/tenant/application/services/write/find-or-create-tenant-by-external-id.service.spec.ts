import { FindOrCreateTenantByExternalIdService } from '@contexts/tenant/application/services/write/find-or-create-tenant-by-external-id.service';
import { TenantAggregate } from '@contexts/tenant/domain/aggregates/tenant.aggregate';
import { TenantBuilder } from '@contexts/tenant/domain/builders/tenant.builder';
import { ITenantWriteRepository } from '@contexts/tenant/domain/repositories/write/tenant-write.repository';
import { TenantExternalIdValueObject } from '@contexts/tenant/domain/value-objects/tenant-external-id/tenant-external-id.vo';

function buildWriteRepositoryMock(): jest.Mocked<ITenantWriteRepository> {
  return {
    findById: jest.fn(),
    findByCriteria: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    findByExternalId: jest.fn(),
  };
}

describe('FindOrCreateTenantByExternalIdService', () => {
  let tenantWriteRepository: jest.Mocked<ITenantWriteRepository>;
  let service: FindOrCreateTenantByExternalIdService;

  beforeEach(() => {
    tenantWriteRepository = buildWriteRepositoryMock();
    service = new FindOrCreateTenantByExternalIdService(tenantWriteRepository);
  });

  it('returns the existing tenant and does not write when one already exists for the externalId', async () => {
    const existing = new TenantBuilder()
      .withId('5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11')
      .withExternalId('idp-tenant-external-id')
      .withCreatedAt(new Date('2026-01-01T00:00:00.000Z'))
      .withUpdatedAt(new Date('2026-01-01T00:00:00.000Z'))
      .build();
    tenantWriteRepository.findByExternalId.mockResolvedValue(existing);

    const result = await service.execute(
      new TenantExternalIdValueObject('idp-tenant-external-id'),
    );

    expect(result).toBe(existing);
    expect(tenantWriteRepository.save).not.toHaveBeenCalled();
    expect(result.getUncommittedEvents()).toHaveLength(0);
  });

  it('creates, persists, and returns a new tenant carrying an uncommitted TenantCreatedEvent when none exists', async () => {
    tenantWriteRepository.findByExternalId.mockResolvedValue(null);
    tenantWriteRepository.save.mockImplementation(
      (aggregate: TenantAggregate) => Promise.resolve(aggregate),
    );

    const result = await service.execute(
      new TenantExternalIdValueObject('new-idp-tenant-external-id'),
    );

    expect(tenantWriteRepository.save).toHaveBeenCalledTimes(1);
    const savedAggregate = tenantWriteRepository.save.mock
      .calls[0][0] as TenantAggregate;
    expect(savedAggregate).toBe(result);
    expect(result.externalId.value).toBe('new-idp-tenant-external-id');
    expect(result.getUncommittedEvents()).toHaveLength(1);
  });
});
