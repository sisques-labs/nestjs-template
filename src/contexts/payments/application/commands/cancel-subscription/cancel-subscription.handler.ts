import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import {
  PAYMENT_PROVIDER_PORT,
  IPaymentProviderPort,
} from '@contexts/payments/application/ports/payment-provider.port';
import { AssertSubscriptionExistsService } from '@contexts/payments/application/services/write/assert-subscription-exists/assert-subscription-exists.service';
import { SubscriptionAggregate } from '@contexts/payments/domain/aggregates/subscription.aggregate';
import { PaymentProviderException } from '@contexts/payments/domain/exceptions/payment-provider.exception';
import {
  SUBSCRIPTION_WRITE_REPOSITORY,
  ISubscriptionWriteRepository,
} from '@contexts/payments/domain/repositories/write/subscription-write.repository';

import { CancelSubscriptionCommand } from './cancel-subscription.command';

@CommandHandler(CancelSubscriptionCommand)
export class CancelSubscriptionCommandHandler
  extends BaseCommandHandler<CancelSubscriptionCommand, SubscriptionAggregate>
  implements ICommandHandler<CancelSubscriptionCommand, void>
{
  private readonly logger = new Logger(CancelSubscriptionCommandHandler.name);

  constructor(
    private readonly assertSubscriptionExistsService: AssertSubscriptionExistsService,
    @Inject(SUBSCRIPTION_WRITE_REPOSITORY)
    private readonly subscriptionWriteRepository: ISubscriptionWriteRepository,
    @Inject(PAYMENT_PROVIDER_PORT)
    private readonly paymentProviderPort: IPaymentProviderPort,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(command: CancelSubscriptionCommand): Promise<void> {
    this.logger.log(
      `Executing CancelSubscriptionCommand for subscription: ${command.subscriptionId.value}`,
    );

    const subscription = await this.assertSubscriptionExistsService.execute(
      command.subscriptionId,
    );
    const primitives = subscription.toPrimitives();

    try {
      await this.paymentProviderPort.cancelSubscription(
        primitives.providerSubscriptionId ?? primitives.id,
      );
    } catch (error) {
      throw new PaymentProviderException((error as Error).message);
    }

    subscription.cancel(command.cancelAtPeriodEnd.value);

    await this.subscriptionWriteRepository.save(subscription);
    await this.publishEvents(subscription);

    this.logger.log(`Subscription cancellation recorded: ${subscription.id}`);
  }
}
