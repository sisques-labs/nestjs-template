import { PingResolver } from './ping.resolver';

describe('PingResolver', () => {
  it('returns "pong"', () => {
    const resolver = new PingResolver();

    expect(resolver.ping()).toBe('pong');
  });
});
