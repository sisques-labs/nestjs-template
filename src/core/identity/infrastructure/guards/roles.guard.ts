import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Role } from '../../domain/enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { getPrincipal, getRequest } from './identity.guard';

/**
 * Enforces `@Roles(...)` metadata against the `IPrincipal` `IdentityGuard`
 * attached to the request. Must run after `IdentityGuard` in the guard
 * chain (`@UseGuards(IdentityGuard, RolesGuard)`) — a handler with no
 * `@Roles()` metadata is allowed through unchecked.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const principal = getPrincipal(getRequest(context));
    if (!principal) {
      throw new ForbiddenException('No authenticated principal on request');
    }

    const hasRequiredRole = requiredRoles.some((role) =>
      principal.roles.includes(role),
    );
    if (!hasRequiredRole) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
