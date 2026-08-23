import { EmailValueObject } from '@sisques-labs/nestjs-kit';
import { FindOrCreateUserByExternalIdService } from '@contexts/users/application/services/write/find-or-create-user-by-external-id.service';
import { UserAggregate } from '@contexts/users/domain/aggregates/user.aggregate';
import { UserBuilder } from '@contexts/users/domain/builders/user.builder';
import { IUserWriteRepository } from '@contexts/users/domain/repositories/write/user-write.repository';
import { UserExternalIdValueObject } from '@contexts/users/domain/value-objects/user-external-id/user-external-id.vo';
import { UserTenantIdValueObject } from '@contexts/users/domain/value-objects/user-tenant-id/user-tenant-id.vo';

const TENANT_ID = '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a12';

function buildWriteRepositoryMock(): jest.Mocked<IUserWriteRepository> {
  return {
    findById: jest.fn(),
    findByCriteria: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    findByExternalId: jest.fn(),
  };
}

function buildExisting(overrides: Partial<{ email: string | null }> = {}) {
  return new UserBuilder()
    .withId('5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11')
    .withTenantId(TENANT_ID)
    .withExternalId('sub-42')
    .withEmail(
      overrides.email !== undefined ? overrides.email : 'alice@example.com',
    )
    .withDisplayName('Alice')
    .withCreatedAt(new Date('2026-01-01T00:00:00.000Z'))
    .withUpdatedAt(new Date('2026-01-01T00:00:00.000Z'))
    .build();
}

describe('FindOrCreateUserByExternalIdService', () => {
  let userWriteRepository: jest.Mocked<IUserWriteRepository>;
  let service: FindOrCreateUserByExternalIdService;

  beforeEach(() => {
    userWriteRepository = buildWriteRepositoryMock();
    service = new FindOrCreateUserByExternalIdService(userWriteRepository);
  });

  it('returns the existing user unchanged and does not write when the email already matches', async () => {
    const existing = buildExisting();
    userWriteRepository.findByExternalId.mockResolvedValue(existing);

    const result = await service.execute(
      new UserTenantIdValueObject(TENANT_ID),
      new UserExternalIdValueObject('sub-42'),
      new EmailValueObject('alice@example.com'),
    );

    expect(result).toBe(existing);
    expect(result.displayName.value).toBe('Alice');
    expect(userWriteRepository.save).not.toHaveBeenCalled();
    expect(result.getUncommittedEvents()).toHaveLength(0);
  });

  it('syncs and persists a changed email, leaving displayName untouched', async () => {
    const existing = buildExisting({ email: 'old@example.com' });
    userWriteRepository.findByExternalId.mockResolvedValue(existing);

    const result = await service.execute(
      new UserTenantIdValueObject(TENANT_ID),
      new UserExternalIdValueObject('sub-42'),
      new EmailValueObject('new@example.com'),
    );

    expect(result).toBe(existing);
    expect(result.email?.value).toBe('new@example.com');
    expect(result.displayName.value).toBe('Alice');
    expect(userWriteRepository.save).toHaveBeenCalledWith(existing);
  });

  it('syncs a null email to a previously-set one', async () => {
    const existing = buildExisting({ email: 'old@example.com' });
    userWriteRepository.findByExternalId.mockResolvedValue(existing);

    const result = await service.execute(
      new UserTenantIdValueObject(TENANT_ID),
      new UserExternalIdValueObject('sub-42'),
      null,
    );

    expect(result.email).toBeNull();
    expect(userWriteRepository.save).toHaveBeenCalledTimes(1);
  });

  it('creates, persists, and returns a new user carrying an uncommitted UserCreatedEvent, defaulting displayName to the email local part', async () => {
    userWriteRepository.findByExternalId.mockResolvedValue(null);
    userWriteRepository.save.mockImplementation((aggregate: UserAggregate) =>
      Promise.resolve(aggregate),
    );

    const result = await service.execute(
      new UserTenantIdValueObject(TENANT_ID),
      new UserExternalIdValueObject('sub-99'),
      new EmailValueObject('bob@example.com'),
    );

    expect(userWriteRepository.save).toHaveBeenCalledTimes(1);
    expect(result.tenantId.value).toBe(TENANT_ID);
    expect(result.externalId.value).toBe('sub-99');
    expect(result.displayName.value).toBe('bob');
    expect(result.getUncommittedEvents()).toHaveLength(1);
  });

  it('defaults displayName to the externalId when there is no email claim', async () => {
    userWriteRepository.findByExternalId.mockResolvedValue(null);
    userWriteRepository.save.mockImplementation((aggregate: UserAggregate) =>
      Promise.resolve(aggregate),
    );

    const result = await service.execute(
      new UserTenantIdValueObject(TENANT_ID),
      new UserExternalIdValueObject('sub-99'),
      null,
    );

    expect(result.email).toBeNull();
    expect(result.displayName.value).toBe('sub-99');
  });

  it('returns the same in-memory instance that was saved, not a value derived from the repository save() call, so uncommitted events survive even if save() would remap', async () => {
    userWriteRepository.findByExternalId.mockResolvedValue(null);
    // Simulates a write repository that remaps on save (like
    // UserTypeOrmWriteRepository really does) — returning a *different*,
    // freshly-hydrated aggregate with no uncommitted events.
    userWriteRepository.save.mockImplementation((aggregate: UserAggregate) =>
      Promise.resolve(
        new UserBuilder()
          .withId(aggregate.id.value)
          .withTenantId(aggregate.tenantId.value)
          .withExternalId(aggregate.externalId.value)
          .withEmail(aggregate.email?.value ?? null)
          .withDisplayName(aggregate.displayName.value)
          .withCreatedAt(aggregate.createdAt.value)
          .withUpdatedAt(aggregate.updatedAt.value)
          .build(),
      ),
    );

    const result = await service.execute(
      new UserTenantIdValueObject(TENANT_ID),
      new UserExternalIdValueObject('sub-99'),
      new EmailValueObject('bob@example.com'),
    );

    expect(result.getUncommittedEvents()).toHaveLength(1);
  });
});
