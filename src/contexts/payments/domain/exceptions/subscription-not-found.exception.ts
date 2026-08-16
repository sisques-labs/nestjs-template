import { BaseException } from '@sisques-labs/nestjs-kit';

export class SubscriptionNotFoundException extends BaseException {
  constructor(id: string) {
    super(`Subscription with id '${id}' was not found`);
  }
}
