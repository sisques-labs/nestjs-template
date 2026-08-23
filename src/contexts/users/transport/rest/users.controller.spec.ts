import { CommandBus } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';

import { IPrincipal } from '@core/identity/application/ports/principal.interface';
import { TenantContextService } from '@core/tenancy/application/services/tenant-context.service';

import { UserViewModel } from '@contexts/users/domain/view-models/user.view-model';
import { UsersController } from '@contexts/users/transport/rest/users.controller';

const TENANT_ID = '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a12';

const PRINCIPAL: IPrincipal = {
  sub: 'sub-42',
  email: 'alice@example.com',
  roles: [],
  tenantIds: ['idp-tenant-1'],
};

function buildCommandBusMock(): jest.Mocked<CommandBus> {
  return {
    execute: jest.fn(),
  } as unknown as jest.Mocked<CommandBus>;
}

function buildTenantContextServiceMock(): jest.Mocked<TenantContextService> {
  return {
    run: jest.fn(),
    get: jest.fn(),
    require: jest.fn().mockReturnValue(TENANT_ID),
  } as unknown as jest.Mocked<TenantContextService>;
}

function buildViewModel(
  overrides: Partial<{ displayName: string }> = {},
): UserViewModel {
  return new UserViewModel({
    id: '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11',
    tenantId: TENANT_ID,
    externalId: 'sub-42',
    email: 'alice@example.com',
    displayName: overrides.displayName ?? 'Alice',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('UsersController', () => {
  let commandBus: jest.Mocked<CommandBus>;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let controller: UsersController;

  beforeEach(() => {
    commandBus = buildCommandBusMock();
    tenantContextService = buildTenantContextServiceMock();
    controller = new UsersController(commandBus, tenantContextService);
  });

  describe('me', () => {
    it('dispatches UpsertUserFromClaimCommand with the resolved tenant id and principal claims, returning the mapped profile', async () => {
      commandBus.execute.mockResolvedValue(buildViewModel());

      const result = await controller.me(PRINCIPAL);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const command = commandBus.execute.mock.calls[0][0] as {
        tenantId: { value: string };
        externalId: { value: string };
        email: { value: string } | null;
      };
      expect(command.tenantId.value).toBe(TENANT_ID);
      expect(command.externalId.value).toBe('sub-42');
      expect(command.email?.value).toBe('alice@example.com');
      expect(result).toEqual({
        id: '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11',
        email: 'alice@example.com',
        displayName: 'Alice',
        tenantId: TENANT_ID,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
    });

    it('throws UnauthorizedException when no principal is attached', async () => {
      await expect(controller.me(undefined)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(commandBus.execute).not.toHaveBeenCalled();
    });
  });

  describe('updateMe', () => {
    it('dispatches UpdateUserDisplayNameCommand with the requested displayName, returning the mapped profile', async () => {
      commandBus.execute.mockResolvedValue(
        buildViewModel({ displayName: 'Alicia' }),
      );

      const result = await controller.updateMe(PRINCIPAL, {
        displayName: 'Alicia',
      });

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const command = commandBus.execute.mock.calls[0][0] as {
        tenantId: { value: string };
        displayName: { value: string };
      };
      expect(command.tenantId.value).toBe(TENANT_ID);
      expect(command.displayName.value).toBe('Alicia');
      expect(result.displayName).toBe('Alicia');
    });

    it('throws UnauthorizedException when no principal is attached', async () => {
      await expect(
        controller.updateMe(undefined, { displayName: 'Alicia' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(commandBus.execute).not.toHaveBeenCalled();
    });
  });
});
