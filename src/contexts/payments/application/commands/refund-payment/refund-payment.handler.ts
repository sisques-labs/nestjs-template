import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler } from '@sisques-labs/nestjs-kit';

import {
  PAYMENT_PROVIDER_PORT,
  IPaymentProviderPort,
} from '@contexts/payments/application/ports/payment-provider.port';
import { AssertPaymentExistsService } from '@contexts/payments/application/services/write/assert-payment-exists/assert-payment-exists.service';
import { PaymentAggregate } from '@contexts/payments/domain/aggregates/payment.aggregate';
import { PaymentProviderException } from '@contexts/payments/domain/exceptions/payment-provider.exception';
import {
  PAYMENT_WRITE_REPOSITORY,
  IPaymentWriteRepository,
} from '@contexts/payments/domain/repositories/write/payment-write.repository';

import { RefundPaymentCommand } from './refund-payment.command';

@CommandHandler(RefundPaymentCommand)
export class RefundPaymentCommandHandler
  extends BaseCommandHandler<RefundPaymentCommand, PaymentAggregate>
  implements ICommandHandler<RefundPaymentCommand, void>
{
  private readonly logger = new Logger(RefundPaymentCommandHandler.name);

  constructor(
    private readonly assertPaymentExistsService: AssertPaymentExistsService,
    @Inject(PAYMENT_WRITE_REPOSITORY)
    private readonly paymentWriteRepository: IPaymentWriteRepository,
    @Inject(PAYMENT_PROVIDER_PORT)
    private readonly paymentProviderPort: IPaymentProviderPort,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(command: RefundPaymentCommand): Promise<void> {
    this.logger.log(
      `Executing RefundPaymentCommand for payment: ${command.paymentId.value}`,
    );

    const payment = await this.assertPaymentExistsService.execute(
      command.paymentId,
    );

    // Domain-side validation (amount within remaining balance) happens
    // before any provider call — an invalid refund never reaches Stripe.
    payment.refund(command.amount);

    const primitives = payment.toPrimitives();
    try {
      await this.paymentProviderPort.refundPayment({
        providerPaymentId: primitives.providerPaymentId ?? primitives.id,
        amount: command.amount ?? primitives.refundedAmount,
        reason: command.reason?.value,
      });
    } catch (error) {
      throw new PaymentProviderException((error as Error).message);
    }

    await this.paymentWriteRepository.save(payment);
    await this.publishEvents(payment);

    this.logger.log(`Payment refunded: ${payment.id}`);
  }
}
