import { EventBus } from '@nestjs/cqrs';

import { UpsertUserFromClaimCommand } from '@contexts/users/application/commands/upsert-user-from-claim/upsert-user-from-claim.command';
import { UpsertUserFromClaimHandler } from '@contexts/users/application/commands/upsert-user-from-claim/upsert-user-from-claim.handler';
import { FindOrCreateUserByExternalIdService } from '@contexts/users/application/services/write/find-or-create-user-by-external-id.service';
import { UserBuilder } from '@contexts/users/domain/builders/user.builder';

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

describe('UpsertUserFromClaimHandler', () => {
  let eventBus: jest.Mocked<EventBus>;
  let findOrCreateUserByExternalIdService: jest.Mocked<FindOrCreateUserByExternalIdService>;
  let handler: UpsertUserFromClaimHandler;

  beforeEach(() => {
    eventBus = buildEventBusMock();
    findOrCreateUserByExternalIdService = buildFindOrCreateServiceMock();
    handler = new UpsertUserFromClaimHandler(
      eventBus,
      findOrCreateUserByExternalIdService,
    );
  });

  it('returns the existing profile and does not publish events when the service resolves an already-existing user', async () => {
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

    const command = new UpsertUserFromClaimCommand({
      tenantId: TENANT_ID,
      externalId: 'sub-42',
      email: 'alice@example.com',
    });
    const result = await handler.execute(command);

    expect(findOrCreateUserByExternalIdService.execute).toHaveBeenCalledWith(
      command.tenantId,
      command.externalId,
      command.email,
    );
    expect(result.id).toBe(existing.id.value);
    expect(result.displayName).toBe('Alice');
    expect(eventBus.publishAll).not.toHaveBeenCalled();
  });

  it('publishes events and returns the new profile when the service resolves a newly created user', async () => {
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

    const command = new UpsertUserFromClaimCommand({
      tenantId: TENANT_ID,
      externalId: 'sub-99',
      email: 'bob@example.com',
    });
    const result = await handler.execute(command);

    expect(result.id).toBe(created.id.value);
    expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
    expect(created.getUncommittedEvents()).toHaveLength(0);
  });
});
