import { IdempotencyKeyValueObject } from './idempotency-key.value-object';

describe('IdempotencyKeyValueObject', () => {
  it('accepts a non-empty key', () => {
    expect(new IdempotencyKeyValueObject('abc-123').value).toBe('abc-123');
  });

  it('rejects an empty key', () => {
    expect(() => new IdempotencyKeyValueObject('')).toThrow();
  });

  it('rejects a whitespace-only key', () => {
    expect(() => new IdempotencyKeyValueObject('   ')).toThrow();
  });
});
