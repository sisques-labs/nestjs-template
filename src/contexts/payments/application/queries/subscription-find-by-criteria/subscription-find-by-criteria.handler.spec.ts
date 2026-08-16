import { Criteria, PaginatedResult } from '@sisques-labs/nestjs-kit';

import { ISubscriptionReadRepository } from '@contexts/payments/domain/repositories/read/subscription-read.repository';
import { SubscriptionViewModel } from '@contexts/payments/domain/view-models/subscription.view-model';

import { SubscriptionFindByCriteriaQuery } from './subscription-find-by-criteria.query';
import { SubscriptionFindByCriteriaQueryHandler } from './subscription-find-by-criteria.handler';

describe('SubscriptionFindByCriteriaQueryHandler', () => {
  let handler: SubscriptionFindByCriteriaQueryHandler;
  let mockReadRepo: jest.Mocked<ISubscriptionReadRepository>;

  beforeEach(() => {
    mockReadRepo = {
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    handler = new SubscriptionFindByCriteriaQueryHandler(mockReadRepo);
  });

  it('delegates the criteria to the read repository', async () => {
    const paginated = new PaginatedResult<SubscriptionViewModel>([], 0, 1, 20);
    mockReadRepo.findByCriteria.mockResolvedValue(paginated);

    const criteria = new Criteria();
    const result = await handler.execute(
      new SubscriptionFindByCriteriaQuery(criteria),
    );

    expect(mockReadRepo.findByCriteria).toHaveBeenCalledWith(criteria);
    expect(result).toBe(paginated);
  });
});
