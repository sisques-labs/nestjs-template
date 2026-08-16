import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler, UuidValueObject } from '@sisques-labs/nestjs-kit';

import {
  PAYMENT_PROVIDER_PORT,
  IPaymentProviderPort,
} from '@contexts/payments/application/ports/payment-provider.port';
import { SubscriptionAggregate } from '@contexts/payments/domain/aggregates/subscription.aggregate';
import { SubscriptionBuilder } from '@contexts/payments/domain/builders/subscription.builder';
import { SubscriptionStatusEnum } from '@contexts/payments/domain/enums/subscription-status.enum';
import { PaymentProviderException } from '@contexts/payments/domain/exceptions/payment-provider.exception';
import {
  SUBSCRIPTION_WRITE_REPOSITORY,
  ISubscriptionWriteRepository,
} from '@contexts/payments/domain/repositories/write/subscription-write.repository';

import { CreateSubscriptionCommand } from './create-subscription.command';
import { CreateSubscriptionResult } from './create-subscription.result';

@CommandHandler(CreateSubscriptionCommand)
export class CreateSubscriptionCommandHandler
  extends BaseCommandHandler<CreateSubscriptionCommand, SubscriptionAggregate>
  implements
    ICommandHandler<CreateSubscriptionCommand, CreateSubscriptionResult>
{
  private readonly logger = new Logger(CreateSubscriptionCommandHandler.name);

  constructor(
    @Inject(SUBSCRIPTION_WRITE_REPOSITORY)
    private readonly subscriptionWriteRepository: ISubscriptionWriteRepository,
    @Inject(PAYMENT_PROVIDER_PORT)
    private readonly paymentProviderPort: IPaymentProviderPort,
    private readonly subscriptionBuilder: SubscriptionBuilder,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(
    command: CreateSubscriptionCommand,
  ): Promise<CreateSubscriptionResult> {
    this.logger.log(
      `Executing CreateSubscriptionCommand for customer: ${command.customerId.value}`,
    );

    const existing =
      await this.subscriptionWriteRepository.findByIdempotencyKey(
        this.paymentProviderPort.providerName,
        command.idempotencyKey.value,
      );
    if (existing) {
      this.logger.log(
        `CreateSubscriptionCommand short-circuited: idempotencyKey already resolved to subscription ${existing.id}`,
      );
      return { subscriptionId: existing.id };
    }

    let result: Awaited<ReturnType<IPaymentProviderPort['createSubscription']>>;
    try {
      result = await this.paymentProviderPort.createSubscription({
        customerId: command.customerId.value,
        priceId: command.priceId.value,
        idempotencyKey: command.idempotencyKey.value,
        metadata: command.metadata?.value as Record<string, string> | undefined,
      });
    } catch (error) {
      throw new PaymentProviderException((error as Error).message);
    }

    const now = new Date();
    const subscription = this.subscriptionBuilder
      .withId(UuidValueObject.generate().value)
      .withProvider(this.paymentProviderPort.providerName)
      .withProviderSubscriptionId(result.providerSubscriptionId)
      .withProviderCustomerId(result.providerCustomerId)
      .withCustomerId(command.customerId.value)
      .withPriceId(command.priceId.value)
      .withStatus(
        (result.status as SubscriptionStatusEnum) ??
          SubscriptionStatusEnum.INCOMPLETE,
      )
      .withCurrentPeriodStart(result.currentPeriodStart)
      .withCurrentPeriodEnd(result.currentPeriodEnd)
      .withCancelAtPeriodEnd(false)
      .withIdempotencyKey(command.idempotencyKey.value)
      .withMetadata(command.metadata?.value)
      .withCreatedAt(now)
      .withUpdatedAt(now)
      .build();

    subscription.create();

    await this.subscriptionWriteRepository.save(subscription);
    await this.publishEvents(subscription);

    this.logger.log(`Subscription created: ${subscription.id}`);

    return { subscriptionId: subscription.id };
  }
}
