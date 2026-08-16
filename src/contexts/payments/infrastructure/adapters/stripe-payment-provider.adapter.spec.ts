import { PaymentsConfig } from '@contexts/payments/infrastructure/config/payments.config';

const mockPaymentIntentsCreate = jest.fn();
const mockRefundsCreate = jest.fn();
const mockSubscriptionsCreate = jest.fn();
const mockSubscriptionsCancel = jest.fn();
const mockConstructEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: { create: mockPaymentIntentsCreate },
    refunds: { create: mockRefundsCreate },
    subscriptions: {
      create: mockSubscriptionsCreate,
      cancel: mockSubscriptionsCancel,
    },
    webhooks: { constructEvent: mockConstructEvent },
  }));
});

// eslint-disable-next-line @typescript-eslint/no-var-requires -- import after jest.mock, matches the module-under-test's own import
import { StripePaymentProviderAdapter } from './stripe-payment-provider.adapter';

const config: PaymentsConfig = {
  provider: 'stripe',
  stripeSecretKey: 'sk_test_123',
  stripeWebhookSecret: 'whsec_test_123',
};

describe('StripePaymentProviderAdapter', () => {
  let adapter: StripePaymentProviderAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new StripePaymentProviderAdapter(config);
  });

  it('exposes providerName STRIPE', () => {
    expect(adapter.providerName).toBe('STRIPE');
  });

  it('createPaymentIntent forwards the idempotency key to Stripe', async () => {
    mockPaymentIntentsCreate.mockResolvedValue({ id: 'pi_123' });

    const result = await adapter.createPaymentIntent({
      amount: 1500,
      currency: 'USD',
      customerId: 'cus_123',
      idempotencyKey: 'idem-1',
    });

    expect(result).toEqual({ providerPaymentId: 'pi_123' });
    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1500, currency: 'usd' }),
      { idempotencyKey: 'idem-1' },
    );
  });

  it('refundPayment maps the result', async () => {
    mockRefundsCreate.mockResolvedValue({ id: 're_1' });

    const result = await adapter.refundPayment({
      providerPaymentId: 'pi_123',
      amount: 500,
    });

    expect(result).toEqual({ providerRefundId: 're_1' });
  });

  it('cancelSubscription delegates to the Stripe SDK', async () => {
    mockSubscriptionsCancel.mockResolvedValue({});

    await adapter.cancelSubscription('sub_123');

    expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_123');
  });

  describe('verifyWebhookSignature', () => {
    it('normalizes payment_intent.succeeded', () => {
      mockConstructEvent.mockReturnValue({
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
      });

      const result = adapter.verifyWebhookSignature(
        Buffer.from('{}'),
        'sig_test',
      );

      expect(result).toEqual({
        providerEventId: 'evt_1',
        type: 'payment_succeeded',
        providerPaymentId: 'pi_123',
      });
    });

    it('normalizes customer.subscription.deleted', () => {
      mockConstructEvent.mockReturnValue({
        id: 'evt_2',
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_123' } },
      });

      const result = adapter.verifyWebhookSignature(
        Buffer.from('{}'),
        'sig_test',
      );

      expect(result).toMatchObject({
        providerEventId: 'evt_2',
        type: 'subscription_deleted',
        providerSubscriptionId: 'sub_123',
        subscriptionStatus: 'CANCELED',
      });
    });

    it('propagates the SDK error on an invalid signature', () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('signature mismatch');
      });

      expect(() =>
        adapter.verifyWebhookSignature(Buffer.from('{}'), 'bad-sig'),
      ).toThrow('signature mismatch');
    });
  });
});
