import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Role } from '@core/identity/domain/enums/role.enum';
import { REQUEST_PRINCIPAL_KEY } from './request-principal.constant';
import { RolesGuard } from './roles.guard';

function buildContext(principal?: { roles: Role[] }): ExecutionContext {
  const request = principal
    ? { headers: {}, [REQUEST_PRINCIPAL_KEY]: principal }
    : { headers: {} };
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function buildReflector(
  requiredRoles: Role[] | undefined,
): jest.Mocked<Reflector> {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
  } as unknown as jest.Mocked<Reflector>;
}

describe('RolesGuard', () => {
  it('allows the request when no roles are required', () => {
    const guard = new RolesGuard(buildReflector(undefined));

    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it('allows the request when the required roles list is empty', () => {
    const guard = new RolesGuard(buildReflector([]));

    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it('throws when roles are required but no principal is on the request', () => {
    const guard = new RolesGuard(buildReflector([Role.ADMIN]));

    expect(() => guard.canActivate(buildContext())).toThrow(ForbiddenException);
  });

  it('throws when the principal lacks every required role', () => {
    const guard = new RolesGuard(buildReflector([Role.ADMIN]));

    expect(() =>
      guard.canActivate(buildContext({ roles: [Role.USER] })),
    ).toThrow(ForbiddenException);
  });

  it('allows the request when the principal has a required role', () => {
    const guard = new RolesGuard(buildReflector([Role.ADMIN, Role.USER]));

    expect(guard.canActivate(buildContext({ roles: [Role.USER] }))).toBe(true);
  });
});
