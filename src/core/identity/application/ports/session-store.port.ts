/**
 * DI token for the active `ISessionStorePort` adapter.
 */
export const SESSION_STORE_PORT = Symbol('SESSION_STORE_PORT');

/**
 * Server-side key/value store backing the OAuth/BFF session login flow.
 * Two lifecycles share this one port, distinguished only by key prefix and
 * TTL: authenticated sessions (`session:{id}`, minutes-to-hours, refreshed
 * on silent token refresh) and short-lived OAuth `state`/PKCE entries
 * (`oauth:{nonce}`, single-use, gone within minutes). No implementation
 * persists anything beyond its TTL — every write MUST carry one.
 */
export interface ISessionStorePort {
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  delete(key: string): Promise<void>;
}
