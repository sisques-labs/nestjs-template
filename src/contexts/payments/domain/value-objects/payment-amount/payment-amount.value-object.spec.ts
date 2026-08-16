import { PaymentAmountValueObject } from './payment-amount.value-object';

describe('PaymentAmountValueObject', () => {
  it('accepts a positive integer', () => {
    expect(new PaymentAmountValueObject(1500).value).toBe(1500);
  });

  it('rejects zero', () => {
    expect(() => new PaymentAmountValueObject(0)).toThrow();
  });

  it('rejects a negative amount', () => {
    expect(() => new PaymentAmountValueObject(-100)).toThrow();
  });

  it('rejects a non-integer amount', () => {
    expect(() => new PaymentAmountValueObject(19.99)).toThrow();
  });
});
