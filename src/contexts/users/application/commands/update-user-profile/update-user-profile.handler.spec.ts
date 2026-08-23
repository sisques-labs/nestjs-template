import { EventBus } from '@nestjs/cqrs';

import { UpdateUserProfileCommand } from '@contexts/users/application/commands/update-user-profile/update-user-profile.command';
import { UpdateUserProfileHandler } from '@contexts/users/application/commands/update-user-profile/update-user-profile.handler';
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

function buildExistingUser() {
  return new UserBuilder()
    .withId('5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11')
    .withTenantId(TENANT_ID)
    .withExternalId('sub-42')
    .withEmail('alice@example.com')
    .withDisplayName('Alice')
    .withAvatarUrl('https://example.com/old.png')
    .withLocale('en-US')
    .withTimezone('America/New_York')
    .withCreatedAt(new Date('2026-01-01T00:00:00.000Z'))
    .withUpdatedAt(new Date('2026-01-01T00:00:00.000Z'))
    .build();
}

describe('UpdateUserProfileHandler', () => {
  let eventBus: jest.Mocked<EventBus>;
  let findOrCreateUserByExternalIdService: jest.Mocked<FindOrCreateUserByExternalIdService>;
  let userWriteRepository: jest.Mocked<IUserWriteRepository>;
  let handler: UpdateUserProfileHandler;

  beforeEach(() => {
    eventBus = buildEventBusMock();
    findOrCreateUserByExternalIdService = buildFindOrCreateServiceMock();
    userWriteRepository = buildWriteRepositoryMock();
    userWriteRepository.save.mockImplementation((aggregate) =>
      Promise.resolve(aggregate),
    );
    handler = new UpdateUserProfileHandler(
      eventBus,
      findOrCreateUserByExternalIdService,
      userWriteRepository,
    );
  });

  it('renames an existing user and does not publish creation events', async () => {
    const existing = buildExistingUser();
    findOrCreateUserByExternalIdService.execute.mockResolvedValue(existing);

    const command = new UpdateUserProfileCommand({
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

  it('leaves avatarUrl untouched when the command omits the key entirely', async () => {
    const existing = buildExistingUser();
    findOrCreateUserByExternalIdService.execute.mockResolvedValue(existing);

    const command = new UpdateUserProfileCommand({
      tenantId: TENANT_ID,
      externalId: 'sub-42',
      email: 'alice@example.com',
      displayName: 'Alicia',
    });
    const result = await handler.execute(command);

    expect(result.avatarUrl).toBe('https://example.com/old.png');
  });

  it('sets avatarUrl when the command provides one', async () => {
    const existing = buildExistingUser();
    findOrCreateUserByExternalIdService.execute.mockResolvedValue(existing);

    const command = new UpdateUserProfileCommand({
      tenantId: TENANT_ID,
      externalId: 'sub-42',
      email: 'alice@example.com',
      displayName: 'Alicia',
      avatarUrl: 'https://example.com/new.png',
    });
    const result = await handler.execute(command);

    expect(result.avatarUrl).toBe('https://example.com/new.png');
  });

  it('clears avatarUrl when the command provides null', async () => {
    const existing = buildExistingUser();
    findOrCreateUserByExternalIdService.execute.mockResolvedValue(existing);

    const command = new UpdateUserProfileCommand({
      tenantId: TENANT_ID,
      externalId: 'sub-42',
      email: 'alice@example.com',
      displayName: 'Alicia',
      avatarUrl: null,
    });
    const result = await handler.execute(command);

    expect(result.avatarUrl).toBeNull();
  });

  it('leaves locale and timezone untouched when the command omits those keys entirely', async () => {
    const existing = buildExistingUser();
    findOrCreateUserByExternalIdService.execute.mockResolvedValue(existing);

    const command = new UpdateUserProfileCommand({
      tenantId: TENANT_ID,
      externalId: 'sub-42',
      email: 'alice@example.com',
      displayName: 'Alicia',
    });
    const result = await handler.execute(command);

    expect(result.locale).toBe('en-US');
    expect(result.timezone).toBe('America/New_York');
  });

  it('sets locale and timezone when the command provides them', async () => {
    const existing = buildExistingUser();
    findOrCreateUserByExternalIdService.execute.mockResolvedValue(existing);

    const command = new UpdateUserProfileCommand({
      tenantId: TENANT_ID,
      externalId: 'sub-42',
      email: 'alice@example.com',
      displayName: 'Alicia',
      locale: 'es-ES',
      timezone: 'Europe/Madrid',
    });
    const result = await handler.execute(command);

    expect(result.locale).toBe('es-ES');
    expect(result.timezone).toBe('Europe/Madrid');
  });

  it('clears locale and timezone when the command provides null for both', async () => {
    const existing = buildExistingUser();
    findOrCreateUserByExternalIdService.execute.mockResolvedValue(existing);

    const command = new UpdateUserProfileCommand({
      tenantId: TENANT_ID,
      externalId: 'sub-42',
      email: 'alice@example.com',
      displayName: 'Alicia',
      locale: null,
      timezone: null,
    });
    const result = await handler.execute(command);

    expect(result.locale).toBeNull();
    expect(result.timezone).toBeNull();
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

    const command = new UpdateUserProfileCommand({
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
