import { BaseException } from '@sisques-labs/nestjs-kit';

export class PaymentNotFoundException extends BaseException {
  constructor(id: string) {
    super(`Payment with id '${id}' was not found`);
  }
}
