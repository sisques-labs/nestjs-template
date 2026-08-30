import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { IPrincipal } from '../../application/interfaces/principal.interface';
import { getPrincipal, getRequest } from '../guards/identity.guard';

/** Factory behind `@CurrentUser()`, exported separately so it can be unit tested directly. */
export function currentUserFactory(
  _data: unknown,
  context: ExecutionContext,
): IPrincipal | undefined {
  return getPrincipal(getRequest(context));
}

/**
 * Extracts the `IPrincipal` `IdentityGuard` attached to the request.
 * `undefined` if the route isn't behind `IdentityGuard`.
 */
export const CurrentUser = createParamDecorator(currentUserFactory);
