import { ExecutionContext } from '@nestjs/common';

import { IPrincipal } from '../../application/interfaces/principal.interface';
import { REQUEST_PRINCIPAL_KEY } from '../guards/request-principal.constant';
import { currentUserFactory } from './current-user.decorator';

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('currentUserFactory', () => {
  it('returns the principal IdentityGuard attached to the request', () => {
    const principal: IPrincipal = {
      sub: 'user-123',
      email: 'user@example.com',
      roles: [],
      tenantIds: [],
    };
    const context = buildContext({
      headers: {},
      [REQUEST_PRINCIPAL_KEY]: principal,
    });

    expect(currentUserFactory(undefined, context)).toEqual(principal);
  });

  it('returns undefined when no principal is on the request', () => {
    const context = buildContext({ headers: {} });

    expect(currentUserFactory(undefined, context)).toBeUndefined();
  });
});
