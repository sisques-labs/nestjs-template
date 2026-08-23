import { EventBus } from '@nestjs/cqrs';

import { UpdateUserDisplayNameCommand } from '@contexts/users/application/commands/update-user-display-name/update-user-display-name.command';
import { UpdateUserDisplayNameHandler } from '@contexts/users/application/commands/update-user-display-name/update-user-display-name.handler';
import { FindOrCreateUserByExternalIdService } from '@contexts/users/application/services/write/find-or-create-user-by-external-id.service';
import { UserBuilder } from '@contexts/users/domain/builders/user.builder';
import { IUserWriteRepository } from '@contexts/users/domain/repositories/write/user-write.repository';

const TENANT_ID = '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a12';

function buildEventBusMock(): jest.Mocked<EventBus> {
  return {
    publishAll: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<EventBus>;
}

function buildFindOrCreateServiceMock(): jest.Mocked<FindOrCreateUserByExternalIdService> {
  return {
    execute: jest.fn(),
  } as unknown as jest.Mocked<FindOrCreateUserByExternalIdService>;
}

function buildWriteRepositoryMock(): jest.Mocked<IUserWriteRepository> {
  return {
    findById: jest.fn(),
    findByCriteria: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    findByExternalId: jest.fn(),
  };
}

describe('UpdateUserDisplayNameHandler', () => {
  let eventBus: jest.Mocked<EventBus>;
  let findOrCreateUserByExternalIdService: jest.Mocked<FindOrCreateUserByExternalIdService>;
  let userWriteRepository: jest.Mocked<IUserWriteRepository>;
  let handler: UpdateUserDisplayNameHandler;

  beforeEach(() => {
    eventBus = buildEventBusMock();
    findOrCreateUserByExternalIdService = buildFindOrCreateServiceMock();
    userWriteRepository = buildWriteRepositoryMock();
    userWriteRepository.save.mockImplementation((aggregate) =>
      Promise.resolve(aggregate),
    );
    handler = new UpdateUserDisplayNameHandler(
      eventBus,
      findOrCreateUserByExternalIdService,
      userWriteRepository,
    );
  });

  it('renames an existing user and does not publish creation events', async () => {
    const existing = new UserBuilder()
      .withId('5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11')
      .withTenantId(TENANT_ID)
      .withExternalId('sub-42')
      .withEmail('alice@example.com')
      .withDisplayName('Alice')
      .withCreatedAt(new Date('2026-01-01T00:00:00.000Z'))
      .withUpdatedAt(new Date('2026-01-01T00:00:00.000Z'))
      .build();
    findOrCreateUserByExternalIdService.execute.mockResolvedValue(existing);

    const command = new UpdateUserDisplayNameCommand({
      tenantId: TENANT_ID,
      externalId: 'sub-42',
      email: 'alice@example.com',
      displayName: 'Alicia',
    });
    const result = await handler.execute(command);

    expect(result.displayName).toBe('Alicia');
    expect(userWriteRepository.save).toHaveBeenCalledWith(existing);
    expect(eventBus.publishAll).not.toHaveBeenCalled();
  });

  it('creates the user on first PATCH, publishes its creation event, then applies the requested displayName (not the default)', async () => {
    const created = new UserBuilder()
      .withId('5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a13')
      .withTenantId(TENANT_ID)
      .withExternalId('sub-99')
      .withEmail('bob@example.com')
      .withDisplayName('bob')
      .withCreatedAt(new Date('2026-01-01T00:00:00.000Z'))
      .withUpdatedAt(new Date('2026-01-01T00:00:00.000Z'))
      .build();
    created.create();
    findOrCreateUserByExternalIdService.execute.mockResolvedValue(created);

    const command = new UpdateUserDisplayNameCommand({
      tenantId: TENANT_ID,
      externalId: 'sub-99',
      email: 'bob@example.com',
      displayName: 'Bobby',
    });
    const result = await handler.execute(command);

    expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
    expect(result.displayName).toBe('Bobby');
  });
});
