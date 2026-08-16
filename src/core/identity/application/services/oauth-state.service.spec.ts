import { ISessionStore } from '../ports/session-store.port';
import { OAuthStateService } from './oauth-state.service';

function buildSessionStore(): jest.Mocked<ISessionStore> {
  return {
    set: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  };
}

describe('OAuthStateService', () => {
  describe('start()', () => {
    it('writes a state/codeVerifier pair keyed by nonce with a 5-minute TTL', async () => {
      const sessionStore = buildSessionStore();
      const service = new OAuthStateService(sessionStore);

      const result = await service.start();

      expect(result.nonce).toEqual(expect.any(String));
      expect(result.state).toEqual(expect.any(String));
      expect(result.codeVerifier).toEqual(expect.any(String));
      expect(result.codeChallenge).toEqual(expect.any(String));
      expect(sessionStore.set).toHaveBeenCalledWith(
        `oauth:${result.nonce}`,
        { state: result.state, codeVerifier: result.codeVerifier },
        300,
      );
    });

    it('derives codeChallenge as the base64url SHA-256 of codeVerifier', async () => {
      const sessionStore = buildSessionStore();
      const service = new OAuthStateService(sessionStore);

      const result = await service.start();

      const { createHash } = await import('crypto');
      const expected = createHash('sha256')
        .update(result.codeVerifier)
        .digest('base64url');
      expect(result.codeChallenge).toBe(expected);
    });
  });

  describe('consume()', () => {
    it('returns the codeVerifier and deletes the entry when state matches', async () => {
      const sessionStore = buildSessionStore();
      sessionStore.get.mockResolvedValue({
        state: 'the-state',
        codeVerifier: 'the-verifier',
      });
      const service = new OAuthStateService(sessionStore);

      const result = await service.consume('nonce-1', 'the-state');

      expect(sessionStore.get).toHaveBeenCalledWith('oauth:nonce-1');
      expect(sessionStore.delete).toHaveBeenCalledWith('oauth:nonce-1');
      expect(result).toEqual({ codeVerifier: 'the-verifier' });
    });

    it('returns null and still deletes the entry when state does not match', async () => {
      const sessionStore = buildSessionStore();
      sessionStore.get.mockResolvedValue({
        state: 'the-state',
        codeVerifier: 'the-verifier',
      });
      const service = new OAuthStateService(sessionStore);

      const result = await service.consume('nonce-1', 'wrong-state');

      expect(sessionStore.delete).toHaveBeenCalledWith('oauth:nonce-1');
      expect(result).toBeNull();
    });

    it('returns null when no entry is stored (expired or never existed)', async () => {
      const sessionStore = buildSessionStore();
      sessionStore.get.mockResolvedValue(null);
      const service = new OAuthStateService(sessionStore);

      const result = await service.consume('nonce-1', 'any-state');

      expect(sessionStore.delete).toHaveBeenCalledWith('oauth:nonce-1');
      expect(result).toBeNull();
    });
  });
});
