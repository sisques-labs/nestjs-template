import { Redis } from 'ioredis';

import { RedisSessionStore } from './redis-session.store';

describe('RedisSessionStore', () => {
  let client: jest.Mocked<Redis>;
  let store: RedisSessionStore;

  beforeEach(() => {
    client = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<Redis>;
    store = new RedisSessionStore(client);
  });

  describe('set()', () => {
    it('JSON-serializes the value and writes it with an EX ttl', async () => {
      await store.set('session:abc', { sub: 'user-1' }, 3600);

      expect(client.set).toHaveBeenCalledWith(
        'session:abc',
        JSON.stringify({ sub: 'user-1' }),
        'EX',
        3600,
      );
    });

    it('serializes primitive values as-is', async () => {
      await store.set('oauth:nonce-1', 'some-state', 300);

      expect(client.set).toHaveBeenCalledWith(
        'oauth:nonce-1',
        JSON.stringify('some-state'),
        'EX',
        300,
      );
    });
  });

  describe('get()', () => {
    it('returns the parsed value when the key exists', async () => {
      client.get.mockResolvedValue(JSON.stringify({ sub: 'user-1' }));

      const result = await store.get<{ sub: string }>('session:abc');

      expect(client.get).toHaveBeenCalledWith('session:abc');
      expect(result).toEqual({ sub: 'user-1' });
    });

    it('returns null when the key does not exist', async () => {
      client.get.mockResolvedValue(null);

      const result = await store.get('session:missing');

      expect(result).toBeNull();
    });
  });

  describe('delete()', () => {
    it('deletes the key', async () => {
      await store.delete('session:abc');

      expect(client.del).toHaveBeenCalledWith('session:abc');
    });
  });
});
