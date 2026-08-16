import { BaseException } from '@sisques-labs/nestjs-kit';

export class InvalidWebhookSignatureException extends BaseException {
  constructor() {
    super('Webhook signature verification failed');
  }
}
