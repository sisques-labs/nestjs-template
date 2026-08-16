import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler, UuidValueObject } from '@sisques-labs/nestjs-kit';

import {
  PAYMENT_PROVIDER_PORT,
  IPaymentProviderPort,
} from '@contexts/payments/application/ports/payment-provider.port';
import { PaymentAggregate } from '@contexts/payments/domain/aggregates/payment.aggregate';
import { PaymentBuilder } from '@contexts/payments/domain/builders/payment.builder';
import { CurrencyEnum } from '@contexts/payments/domain/enums/currency.enum';
import { PaymentStatusEnum } from '@contexts/payments/domain/enums/payment-status.enum';
import { PaymentProviderException } from '@contexts/payments/domain/exceptions/payment-provider.exception';
import {
  PAYMENT_WRITE_REPOSITORY,
  IPaymentWriteRepository,
} from '@contexts/payments/domain/repositories/write/payment-write.repository';

import { CreatePaymentCommand } from './create-payment.command';
import { CreatePaymentResult } from './create-payment.result';

@CommandHandler(CreatePaymentCommand)
export class CreatePaymentCommandHandler
  extends BaseCommandHandler<CreatePaymentCommand, PaymentAggregate>
  implements ICommandHandler<CreatePaymentCommand, CreatePaymentResult>
{
  private readonly logger = new Logger(CreatePaymentCommandHandler.name);

  constructor(
    @Inject(PAYMENT_WRITE_REPOSITORY)
    private readonly paymentWriteRepository: IPaymentWriteRepository,
    @Inject(PAYMENT_PROVIDER_PORT)
    private readonly paymentProviderPort: IPaymentProviderPort,
    private readonly paymentBuilder: PaymentBuilder,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(command: CreatePaymentCommand): Promise<CreatePaymentResult> {
    this.logger.log(
      `Executing CreatePaymentCommand for customer: ${command.customerId.value}`,
    );

    const existing = await this.paymentWriteRepository.findByIdempotencyKey(
      this.paymentProviderPort.providerName,
      command.idempotencyKey.value,
    );
    if (existing) {
      this.logger.log(
        `CreatePaymentCommand short-circuited: idempotencyKey already resolved to payment ${existing.id}`,
      );
      return { paymentId: existing.id };
    }

    let providerPaymentId: string;
    try {
      const result = await this.paymentProviderPort.createPaymentIntent({
        amount: command.amount.value,
        currency: command.currency.value,
        customerId: command.customerId.value,
        idempotencyKey: command.idempotencyKey.value,
        description: command.description?.value,
        metadata: command.metadata?.value as Record<string, string> | undefined,
      });
      providerPaymentId = result.providerPaymentId;
    } catch (error) {
      throw new PaymentProviderException((error as Error).message);
    }

    const now = new Date();
    const payment = this.paymentBuilder
      .withId(UuidValueObject.generate().value)
      .withProvider(this.paymentProviderPort.providerName)
      .withProviderPaymentId(providerPaymentId)
      .withCustomerId(command.customerId.value)
      .withAmount(command.amount.value)
      .withCurrency(command.currency.value as CurrencyEnum)
      .withStatus(PaymentStatusEnum.PENDING)
      .withIdempotencyKey(command.idempotencyKey.value)
      .withRefundedAmount(0)
      .withDescription(command.description?.value)
      .withMetadata(command.metadata?.value)
      .withCreatedAt(now)
      .withUpdatedAt(now)
      .build();

    payment.create();

    await this.paymentWriteRepository.save(payment);
    await this.publishEvents(payment);

    this.logger.log(`Payment created: ${payment.id}`);

    return { paymentId: payment.id };
  }
}
