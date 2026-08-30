import { CommandBus } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';

import { IPrincipal } from '@core/identity/application/ports/interfaces/principal.interface';
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
  overrides: Partial<{
    displayName: string;
    avatarUrl: string | null;
    locale: string | null;
    timezone: string | null;
  }> = {},
): UserViewModel {
  return new UserViewModel({
    id: '5f8d0d55-1c3a-4b7e-9a2f-3b6d1e0c9a11',
    tenantId: TENANT_ID,
    externalId: 'sub-42',
    email: 'alice@example.com',
    displayName: overrides.displayName ?? 'Alice',
    avatarUrl: overrides.avatarUrl ?? null,
    locale: overrides.locale ?? null,
    timezone: overrides.timezone ?? null,
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
        avatarUrl: null,
        locale: null,
        timezone: null,
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
    it('dispatches UpdateUserProfileCommand with the requested displayName, returning the mapped profile', async () => {
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
        avatarUrl: { value: string } | null | undefined;
      };
      expect(command.tenantId.value).toBe(TENANT_ID);
      expect(command.displayName.value).toBe('Alicia');
      expect(command.avatarUrl).toBeUndefined();
      expect(result.displayName).toBe('Alicia');
    });

    it('passes avatarUrl through when the request body includes it', async () => {
      commandBus.execute.mockResolvedValue(
        buildViewModel({ avatarUrl: 'https://example.com/new.png' }),
      );

      await controller.updateMe(PRINCIPAL, {
        displayName: 'Alicia',
        avatarUrl: 'https://example.com/new.png',
      });

      const command = commandBus.execute.mock.calls[0][0] as {
        avatarUrl: { value: string } | null | undefined;
      };
      expect(command.avatarUrl?.value).toBe('https://example.com/new.png');
    });

    it('passes a null avatarUrl through as a clear request, not "omitted"', async () => {
      commandBus.execute.mockResolvedValue(buildViewModel());

      await controller.updateMe(PRINCIPAL, {
        displayName: 'Alicia',
        avatarUrl: null,
      });

      const command = commandBus.execute.mock.calls[0][0] as {
        avatarUrl: { value: string } | null | undefined;
      };
      expect(command.avatarUrl).toBeNull();
    });

    it('passes locale and timezone through when the request body includes them', async () => {
      commandBus.execute.mockResolvedValue(
        buildViewModel({ locale: 'es-ES', timezone: 'Europe/Madrid' }),
      );

      await controller.updateMe(PRINCIPAL, {
        displayName: 'Alicia',
        locale: 'es-ES',
        timezone: 'Europe/Madrid',
      });

      const command = commandBus.execute.mock.calls[0][0] as {
        locale: { value: string } | null | undefined;
        timezone: { value: string } | null | undefined;
      };
      expect(command.locale?.value).toBe('es-ES');
      expect(command.timezone?.value).toBe('Europe/Madrid');
    });

    it('passes null locale and timezone through as clear requests, not "omitted"', async () => {
      commandBus.execute.mockResolvedValue(buildViewModel());

      await controller.updateMe(PRINCIPAL, {
        displayName: 'Alicia',
        locale: null,
        timezone: null,
      });

      const command = commandBus.execute.mock.calls[0][0] as {
        locale: { value: string } | null | undefined;
        timezone: { value: string } | null | undefined;
      };
      expect(command.locale).toBeNull();
      expect(command.timezone).toBeNull();
    });

    it('throws UnauthorizedException when no principal is attached', async () => {
      await expect(
        controller.updateMe(undefined, { displayName: 'Alicia' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(commandBus.execute).not.toHaveBeenCalled();
    });
  });
});
