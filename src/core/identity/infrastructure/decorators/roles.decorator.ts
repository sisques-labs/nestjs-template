import { SetMetadata } from '@nestjs/common';

import { Role } from '../../domain/enums/role.enum';

export const ROLES_KEY = 'identity:roles';

/** Marks a handler as requiring one of the given roles — enforced by `RolesGuard`. */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
