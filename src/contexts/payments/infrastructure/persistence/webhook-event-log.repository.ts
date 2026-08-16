import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IWebhookEventLogRepository } from '@contexts/payments/domain/repositories/webhook-event-log.repository';

import { PaymentWebhookEventTypeOrmEntity } from './typeorm/entities/payment-webhook-event.entity';

/**
 * Idempotency dedup log for inbound webhooks. Plain repository (no
 * read/write split, no builder/mapper) — this table has no domain
 * behavior, it exists purely so a redelivered event is a no-op.
 */
@Injectable()
export class WebhookEventLogRepository implements IWebhookEventLogRepository {
  constructor(
    @InjectRepository(PaymentWebhookEventTypeOrmEntity)
    private readonly repository: Repository<PaymentWebhookEventTypeOrmEntity>,
  ) {}

  async hasProcessed(
    provider: string,
    providerEventId: string,
  ): Promise<boolean> {
    const count = await this.repository.count({
      where: { provider, providerEventId },
    });
    return count > 0;
  }

  async markProcessed(
    provider: string,
    providerEventId: string,
  ): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(PaymentWebhookEventTypeOrmEntity)
      .values({ provider, providerEventId })
      .orIgnore()
      .execute();
  }
}
