import { Criteria, PaginatedResult } from '@sisques-labs/nestjs-kit';

import { IPaymentReadRepository } from '@contexts/payments/domain/repositories/read/payment-read.repository';
import { PaymentViewModel } from '@contexts/payments/domain/view-models/payment.view-model';

import { PaymentFindByCriteriaQuery } from './payment-find-by-criteria.query';
import { PaymentFindByCriteriaQueryHandler } from './payment-find-by-criteria.handler';

describe('PaymentFindByCriteriaQueryHandler', () => {
  let handler: PaymentFindByCriteriaQueryHandler;
  let mockReadRepo: jest.Mocked<IPaymentReadRepository>;

  beforeEach(() => {
    mockReadRepo = {
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    handler = new PaymentFindByCriteriaQueryHandler(mockReadRepo);
  });

  it('delegates the criteria to the read repository', async () => {
    const paginated = new PaginatedResult<PaymentViewModel>([], 0, 1, 20);
    mockReadRepo.findByCriteria.mockResolvedValue(paginated);

    const criteria = new Criteria();
    const result = await handler.execute(
      new PaymentFindByCriteriaQuery(criteria),
    );

    expect(mockReadRepo.findByCriteria).toHaveBeenCalledWith(criteria);
    expect(result).toBe(paginated);
  });
});
