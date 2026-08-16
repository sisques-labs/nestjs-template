import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { REQUEST_PRINCIPAL_KEY } from '@core/identity/infrastructure/guards/request-principal.constant';

import { getTenantId } from '../request-tenant-id.constant';
import { TENANT_ID_HEADER, TenantGuard } from './tenant.guard';

function buildContext(options?: { tenantIds?: string[]; header?: string }): {
  context: ExecutionContext;
  request: Record<string, unknown>;
} {
  const headers: Record<string, string> = {};
  if (options?.header !== undefined) {
    headers[TENANT_ID_HEADER] = options.header;
  }

  const request: Record<string, unknown> = options
    ? {
        headers,
        [REQUEST_PRINCIPAL_KEY]: { tenantIds: options.tenantIds ?? [] },
      }
    : { headers };

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
  it('allows the request and attaches the resolved tenant id when the header names a tenant the principal belongs to', async () => {
    const commandBus = buildCommandBus();
    commandBus.execute.mockResolvedValue('internal-tenant-id');
    const guard = new TenantGuard(commandBus);

    const { context, request } = buildContext({
      tenantIds: ['tenant-42', 'tenant-99'],
      header: 'tenant-99',
    });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: expect.objectContaining({ value: 'tenant-99' }),
      }),
    );
    expect(getTenantId(request as never)).toBe('internal-tenant-id');
  });

  it('throws ForbiddenException and never calls CommandBus when the header names a tenant the principal does NOT belong to', async () => {
    const commandBus = buildCommandBus();
    const guard = new TenantGuard(commandBus);

    const { context } = buildContext({
      tenantIds: ['tenant-42'],
      header: 'tenant-not-mine',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('allows the request and uses the sole tenant id when the header is absent and tenantIds has exactly one entry', async () => {
    const commandBus = buildCommandBus();
    commandBus.execute.mockResolvedValue('internal-tenant-id');
    const guard = new TenantGuard(commandBus);

    const { context, request } = buildContext({ tenantIds: ['tenant-42'] });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: expect.objectContaining({ value: 'tenant-42' }),
      }),
    );
    expect(getTenantId(request as never)).toBe('internal-tenant-id');
  });

  it('throws ForbiddenException and never calls CommandBus when the header is absent and tenantIds is empty', async () => {
    const commandBus = buildCommandBus();
    const guard = new TenantGuard(commandBus);

    const { context } = buildContext({ tenantIds: [] });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException and never calls CommandBus when the header is absent and tenantIds has more than one entry', async () => {
    const commandBus = buildCommandBus();
    const guard = new TenantGuard(commandBus);

    const { context } = buildContext({ tenantIds: ['tenant-1', 'tenant-2'] });

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
