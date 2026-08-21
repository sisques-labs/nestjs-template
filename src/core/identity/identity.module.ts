import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import { identityProviderFactory } from './application/services/identity-provider.factory';
import { IDENTITY_PROVIDER } from './application/ports/identity-provider.port';
import { SESSION_STORE } from './application/ports/session-store.port';
import { OAuthStateService } from './application/services/oauth-state.service';
import { IdentityGuard } from './infrastructure/guards/identity.guard';
import { RolesGuard } from './infrastructure/guards/roles.guard';
import {
  REDIS_CLIENT,
  RedisSessionStore,
} from './infrastructure/session/redis-session.store';
import { AuthController } from './transport/rest/auth.controller';
import { OAuthController } from './transport/rest/oauth.controller';

const OAUTH_SESSION_ENABLED = process.env.OAUTH_SESSION_ENABLED === 'true';

const IDENTITY_PROVIDERS = [
  {
    provide: IDENTITY_PROVIDER,
    useFactory: identityProviderFactory,
    inject: [ConfigService],
  },
];
// Only wired when OAUTH_SESSION_ENABLED — absent, not present-but-unused,
// when the OAuth/BFF session login flow is off. IdentityGuard stays
// unconditionally provided (see below) and keeps working bearer-only via
// its @Optional() SESSION_STORE injection when this feature is disabled.
const SESSION_PROVIDERS = OAUTH_SESSION_ENABLED
  ? [
      {
        provide: REDIS_CLIENT,
        useFactory: (config: ConfigService) =>
          new Redis(config.getOrThrow('SESSION_REDIS_URL')),
        inject: [ConfigService],
      },
      { provide: SESSION_STORE, useClass: RedisSessionStore },
      OAuthStateService,
    ]
  : [];
const INFRASTRUCTURE_GUARDS = [IdentityGuard, RolesGuard];
const TRANSPORT_CONTROLLERS = [
  AuthController,
  ...(OAUTH_SESSION_ENABLED ? [OAuthController] : []),
];

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
  providers: [
    ...IDENTITY_PROVIDERS,
    ...SESSION_PROVIDERS,
    ...INFRASTRUCTURE_GUARDS,
  ],
  exports: [IDENTITY_PROVIDER, SESSION_STORE, IdentityGuard, RolesGuard],
})
export class IdentityModule {}
