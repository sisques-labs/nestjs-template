import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { identityProviderFactory } from './application/services/identity-provider.factory';
import { IDENTITY_PROVIDER } from './application/ports/identity-provider.port';
import { IdentityGuard } from './infrastructure/guards/identity.guard';
import { RolesGuard } from './infrastructure/guards/roles.guard';
import { AuthController } from './transport/rest/auth.controller';

const IDENTITY_PROVIDERS = [
  {
    provide: IDENTITY_PROVIDER,
    useFactory: identityProviderFactory,
    inject: [ConfigService],
  },
];
const INFRASTRUCTURE_GUARDS = [IdentityGuard, RolesGuard];
const TRANSPORT_CONTROLLERS = [AuthController];

/**
 * Cross-cutting identity bridge — not a bounded context, so it is wired
 * directly into `CORE_MODULES` (see `core.module.ts`), not registered via
 * `CONTEXT_MODULES`. `IdentityGuard`/`RolesGuard` are exported for opt-in
 * use (`@UseGuards(IdentityGuard, RolesGuard)`) on whichever
 * controllers/resolvers a service adds — they are not applied globally, so
 * importing this module does not require auth on existing routes.
 */
@Module({
  imports: [ConfigModule],
  controllers: [...TRANSPORT_CONTROLLERS],
  providers: [...IDENTITY_PROVIDERS, ...INFRASTRUCTURE_GUARDS],
  exports: [IDENTITY_PROVIDER, IdentityGuard, RolesGuard],
})
export class IdentityModule {}
