import { createHash, randomBytes, randomUUID } from 'crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';

import { ISessionStorePort, SESSION_STORE } from '../ports/session-store.port';

/**
 * TTL for a pending OAuth `state`/PKCE entry — the window between
 * `GET /auth/oauth/start` and the provider redirecting back to
 * `GET /auth/oauth/callback`. Single-use, gone the moment it's consumed.
 */
const OAUTH_STATE_TTL_SECONDS = 300;

interface StoredOAuthState {
  state: string;
  codeVerifier: string;
}

/**
 * Generates and validates the PKCE + CSRF-state pair for the OAuth
 * redirect flow, backed by `ISessionStore`. Entries are keyed by a random
 * `nonce` (round-tripped to the browser via a short-lived cookie, never
 * the `state`/`codeVerifier` themselves) so the callback can find its
 * matching `start()` call.
 */
@Injectable()
export class OAuthStateService {
  private readonly logger = new Logger(OAuthStateService.name);

  constructor(
    @Inject(SESSION_STORE) private readonly sessionStore: ISessionStorePort,
  ) {}

  async start(): Promise<{
    nonce: string;
    state: string;
    codeVerifier: string;
    codeChallenge: string;
  }> {
    const nonce = randomUUID();
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    this.logger.log(`Starting OAuth state for nonce "${nonce}"`);
    await this.sessionStore.set(
      `oauth:${nonce}`,
      { state, codeVerifier } satisfies StoredOAuthState,
      OAUTH_STATE_TTL_SECONDS,
    );

    return { nonce, state, codeVerifier, codeChallenge };
  }

  async consume(
    nonce: string,
    state: string,
  ): Promise<{ codeVerifier: string } | null> {
    this.logger.log(`Consuming OAuth state for nonce "${nonce}"`);
    const key = `oauth:${nonce}`;
    const stored = await this.sessionStore.get<StoredOAuthState>(key);
    await this.sessionStore.delete(key);

    if (!stored || stored.state !== state) {
      return null;
    }

    return { codeVerifier: stored.codeVerifier };
  }
}
