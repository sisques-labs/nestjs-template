import { AssertSubscriptionViewModelExistsService } from '@contexts/payments/application/services/read/assert-subscription-view-model-exists/assert-subscription-view-model-exists.service';
import { SubscriptionNotFoundException } from '@contexts/payments/domain/exceptions/subscription-not-found.exception';
import { ISubscriptionReadRepository } from '@contexts/payments/domain/repositories/read/subscription-read.repository';
import { SubscriptionViewModel } from '@contexts/payments/domain/view-models/subscription.view-model';

import { SubscriptionFindByIdQuery } from './subscription-find-by-id.query';
import { SubscriptionFindByIdQueryHandler } from './subscription-find-by-id.handler';

const SUBSCRIPTION_ID = '770e8400-e29b-41d4-a716-446655440002';

describe('SubscriptionFindByIdQueryHandler', () => {
  let handler: SubscriptionFindByIdQueryHandler;
  let mockReadRepo: jest.Mocked<ISubscriptionReadRepository>;

  beforeEach(() => {
    mockReadRepo = {
      findById: jest.fn(),
      findByCriteria: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    handler = new SubscriptionFindByIdQueryHandler(
      new AssertSubscriptionViewModelExistsService(mockReadRepo),
    );
  });

  it('returns the view model when found', async () => {
    const vm = { id: SUBSCRIPTION_ID } as SubscriptionViewModel;
    mockReadRepo.findById.mockResolvedValue(vm);

    const result = await handler.execute(
      new SubscriptionFindByIdQuery({ id: SUBSCRIPTION_ID }),
    );

    expect(result).toBe(vm);
  });

  it('throws SubscriptionNotFoundException when not found', async () => {
    mockReadRepo.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new SubscriptionFindByIdQuery({ id: SUBSCRIPTION_ID })),
    ).rejects.toThrow(SubscriptionNotFoundException);
  });
});
