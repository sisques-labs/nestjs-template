import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import {
  PAYMENT_PROVIDER_PORT,
  IPaymentProviderPort,
} from '@contexts/payments/application/ports/payment-provider.port';
import { PaymentProviderWebhookEvent } from '@contexts/payments/application/ports/payment-provider-webhook-event.interface';
import { PaymentAggregate } from '@contexts/payments/domain/aggregates/payment.aggregate';
import { SubscriptionAggregate } from '@contexts/payments/domain/aggregates/subscription.aggregate';
import { SubscriptionStatusEnum } from '@contexts/payments/domain/enums/subscription-status.enum';
import { InvalidWebhookSignatureException } from '@contexts/payments/domain/exceptions/invalid-webhook-signature.exception';
import {
  PAYMENT_WRITE_REPOSITORY,
  IPaymentWriteRepository,
} from '@contexts/payments/domain/repositories/write/payment-write.repository';
import {
  SUBSCRIPTION_WRITE_REPOSITORY,
  ISubscriptionWriteRepository,
} from '@contexts/payments/domain/repositories/write/subscription-write.repository';
import {
  WEBHOOK_EVENT_LOG_REPOSITORY,
  IWebhookEventLogRepository,
} from '@contexts/payments/domain/repositories/webhook-event-log.repository';

import { ProcessPaymentProviderWebhookEventCommand } from './process-payment-provider-webhook-event.command';

@CommandHandler(ProcessPaymentProviderWebhookEventCommand)
export class ProcessPaymentProviderWebhookEventCommandHandler
  extends BaseCommandHandler<
    ProcessPaymentProviderWebhookEventCommand,
    PaymentAggregate | SubscriptionAggregate
  >
  implements ICommandHandler<ProcessPaymentProviderWebhookEventCommand, void>
{
  private readonly logger = new Logger(
    ProcessPaymentProviderWebhookEventCommandHandler.name,
  );

  constructor(
    @Inject(PAYMENT_PROVIDER_PORT)
    private readonly paymentProviderPort: IPaymentProviderPort,
    @Inject(WEBHOOK_EVENT_LOG_REPOSITORY)
    private readonly webhookEventLogRepository: IWebhookEventLogRepository,
    @Inject(PAYMENT_WRITE_REPOSITORY)
    private readonly paymentWriteRepository: IPaymentWriteRepository,
    @Inject(SUBSCRIPTION_WRITE_REPOSITORY)
    private readonly subscriptionWriteRepository: ISubscriptionWriteRepository,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(
    command: ProcessPaymentProviderWebhookEventCommand,
  ): Promise<void> {
    this.logger.log('Executing ProcessPaymentProviderWebhookEventCommand');

    let event: PaymentProviderWebhookEvent;
    try {
      event = this.paymentProviderPort.verifyWebhookSignature(
        command.rawBody,
        command.signature,
      );
    } catch {
      throw new InvalidWebhookSignatureException();
    }

    const provider = this.paymentProviderPort.providerName;
    const alreadyProcessed = await this.webhookEventLogRepository.hasProcessed(
      provider,
      event.providerEventId,
    );
    if (alreadyProcessed) {
      this.logger.log(
        `Webhook event already processed, skipping: ${event.providerEventId}`,
      );
      return;
    }

    switch (event.type) {
      case 'payment_succeeded':
        await this.handlePaymentSucceeded(event);
        break;
      case 'payment_failed':
        await this.handlePaymentFailed(event);
        break;
      case 'charge_refunded':
        await this.handleChargeRefunded(event);
        break;
      case 'invoice_paid':
      case 'subscription_updated':
        await this.handleSubscriptionSync(event);
        break;
      case 'subscription_deleted':
        await this.handleSubscriptionSync({
          ...event,
          subscriptionStatus: SubscriptionStatusEnum.CANCELED,
        });
        break;
    }

    await this.webhookEventLogRepository.markProcessed(
      provider,
      event.providerEventId,
    );

    this.logger.log(
      `Webhook event processed: ${event.type} (${event.providerEventId})`,
    );
  }

  private async handlePaymentSucceeded(
    event: PaymentProviderWebhookEvent,
  ): Promise<void> {
    if (!event.providerPaymentId) return;
    const payment = await this.paymentWriteRepository.findByProviderPaymentId(
      event.providerPaymentId,
    );
    if (!payment) {
      this.logger.warn(
        `No payment found for providerPaymentId: ${event.providerPaymentId}`,
      );
      return;
    }
    payment.markSucceeded(event.providerPaymentId);
    await this.paymentWriteRepository.save(payment);
    await this.publishEvents(payment);
  }

  private async handlePaymentFailed(
    event: PaymentProviderWebhookEvent,
  ): Promise<void> {
    if (!event.providerPaymentId) return;
    const payment = await this.paymentWriteRepository.findByProviderPaymentId(
      event.providerPaymentId,
    );
    if (!payment) {
      this.logger.warn(
        `No payment found for providerPaymentId: ${event.providerPaymentId}`,
      );
      return;
    }
    payment.markFailed();
    await this.paymentWriteRepository.save(payment);
    await this.publishEvents(payment);
  }

  private async handleChargeRefunded(
    event: PaymentProviderWebhookEvent,
  ): Promise<void> {
    if (!event.providerPaymentId || event.refundedAmount === undefined) {
      return;
    }
    const payment = await this.paymentWriteRepository.findByProviderPaymentId(
      event.providerPaymentId,
    );
    if (!payment) {
      this.logger.warn(
        `No payment found for providerPaymentId: ${event.providerPaymentId}`,
      );
      return;
    }
    const primitives = payment.toPrimitives();
    const delta = event.refundedAmount - primitives.refundedAmount;
    if (delta <= 0) {
      return;
    }
    payment.refund(delta);
    await this.paymentWriteRepository.save(payment);
    await this.publishEvents(payment);
  }

  private async handleSubscriptionSync(
    event: PaymentProviderWebhookEvent,
  ): Promise<void> {
    if (!event.providerSubscriptionId || !event.subscriptionStatus) {
      return;
    }
    const subscription =
      await this.subscriptionWriteRepository.findByProviderSubscriptionId(
        event.providerSubscriptionId,
      );
    if (!subscription) {
      this.logger.warn(
        `No subscription found for providerSubscriptionId: ${event.providerSubscriptionId}`,
      );
      return;
    }
    subscription.syncStatus(
      event.subscriptionStatus as SubscriptionStatusEnum,
      event.currentPeriodStart,
      event.currentPeriodEnd,
    );
    await this.subscriptionWriteRepository.save(subscription);
    await this.publishEvents(subscription);
  }
}
