import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { REQUEST_PRINCIPAL_KEY } from '@core/identity/infrastructure/guards/request-principal.constant';

import { getTenantId } from '../request-tenant-id.constant';
import { TenantGuard } from './tenant.guard';

function buildContext(principal?: { tenantId: string | null }): {
  context: ExecutionContext;
  request: Record<string, unknown>;
} {
  const request: Record<string, unknown> = principal
    ? { headers: {}, [REQUEST_PRINCIPAL_KEY]: principal }
    : { headers: {} };
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
  return { context, request };
}

function buildCommandBus(): jest.Mocked<CommandBus> {
  return {
    execute: jest.fn(),
  } as unknown as jest.Mocked<CommandBus>;
}

describe('TenantGuard', () => {
  it('allows the request and attaches the resolved tenant id to it when the principal carries a tenant claim', async () => {
    const commandBus = buildCommandBus();
    commandBus.execute.mockResolvedValue('internal-tenant-id');
    const guard = new TenantGuard(commandBus);

    const { context, request } = buildContext({ tenantId: 'tenant-42' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: expect.objectContaining({ value: 'tenant-42' }),
      }),
    );
    expect(getTenantId(request as never)).toBe('internal-tenant-id');
  });

  it('throws ForbiddenException and never calls CommandBus when tenantId is null', async () => {
    const commandBus = buildCommandBus();
    const guard = new TenantGuard(commandBus);

    const { context } = buildContext({ tenantId: null });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException and never calls CommandBus when no principal is attached', async () => {
    const commandBus = buildCommandBus();
    const guard = new TenantGuard(commandBus);

    const { context } = buildContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
