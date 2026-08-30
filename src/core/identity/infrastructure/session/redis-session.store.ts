import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

import { ISessionStore } from '@core/identity/application/ports/session-store.port';

/**
 * DI token for the `ioredis` client instance backing `RedisSessionStore`.
 * Bound to a real connection (from `SESSION_REDIS_URL`) by whichever module
 * wires `SESSION_STORE` — see `identity.module.ts`.
 */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * `ISessionStore` backed by Redis. Values are JSON-serialized; every write
 * carries the caller's TTL via `SET ... EX` — nothing is written without an
 * expiry. Only key names are logged, never values: session records hold the
 * provider's live `accessToken`/`refreshToken`.
 */
@Injectable()
export class RedisSessionStore implements ISessionStore {
  private readonly logger = new Logger(RedisSessionStore.name);

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.logger.debug(
      `Writing session store key "${key}" (ttl=${ttlSeconds}s)`,
    );
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    this.logger.debug(`Wrote session store key "${key}"`);
  }

  async get<T>(key: string): Promise<T | null> {
    this.logger.debug(`Reading session store key "${key}"`);
    const raw = await this.client.get(key);
    this.logger.debug(
      `Read session store key "${key}" (found=${raw !== null})`,
    );

    if (raw === null) {
      return null;
    }

    return JSON.parse(raw) as T;
  }

  async delete(key: string): Promise<void> {
    this.logger.debug(`Deleting session store key "${key}"`);
    await this.client.del(key);
    this.logger.debug(`Deleted session store key "${key}"`);
  }
}
