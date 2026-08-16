import { AssertPaymentViewModelExistsService } from '@contexts/payments/application/services/read/assert-payment-view-model-exists/assert-payment-view-model-exists.service';
import { PaymentNotFoundException } from '@contexts/payments/domain/exceptions/payment-not-found.exception';
import { IPaymentReadRepository } from '@contexts/payments/domain/repositories/read/payment-read.repository';
import { PaymentViewModel } from '@contexts/payments/domain/view-models/payment.view-model';

import { PaymentFindByIdQuery } from './payment-find-by-id.query';
import { PaymentFindByIdQueryHandler } from './payment-find-by-id.handler';

const PAYMENT_ID = '660e8400-e29b-41d4-a716-446655440001';

describe('PaymentFindByIdQueryHandler', () => {
  let handler: PaymentFindByIdQueryHandler;
  let mockReadRepo: jest.Mocked<IPaymentReadRepository>;

  beforeEach(() => {
    mockReadRepo = {
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    handler = new PaymentFindByIdQueryHandler(
      new AssertPaymentViewModelExistsService(mockReadRepo),
    );
  });

  it('returns the view model when found', async () => {
    const vm = { id: PAYMENT_ID } as PaymentViewModel;
    mockReadRepo.findById.mockResolvedValue(vm);

    const result = await handler.execute(
      new PaymentFindByIdQuery({ id: PAYMENT_ID }),
    );

    expect(result).toBe(vm);
  });

  it('throws PaymentNotFoundException when not found', async () => {
    mockReadRepo.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new PaymentFindByIdQuery({ id: PAYMENT_ID })),
    ).rejects.toThrow(PaymentNotFoundException);
  });
});
