import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  MutationResponseDto,
  MutationResponseGraphQLMapper,
} from '@sisques-labs/nestjs-kit/graphql';

import { CreatePaymentCommand } from '@contexts/payments/application/commands/create-payment/create-payment.command';
import { CreatePaymentResult } from '@contexts/payments/application/commands/create-payment/create-payment.result';
import { RefundPaymentCommand } from '@contexts/payments/application/commands/refund-payment/refund-payment.command';
import { CreatePaymentRequestDto } from '@contexts/payments/transport/graphql/dtos/requests/create-payment.request.dto';
import { RefundPaymentRequestDto } from '@contexts/payments/transport/graphql/dtos/requests/refund-payment.request.dto';

@Resolver()
export class PaymentMutationsResolver {
  private readonly logger = new Logger(PaymentMutationsResolver.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly mutationResponseGraphQLMapper: MutationResponseGraphQLMapper,
  ) {}

  @Mutation(() => MutationResponseDto)
  async createPayment(
    @Args('input') input: CreatePaymentRequestDto,
  ): Promise<MutationResponseDto> {
    this.logger.log(`Creating payment for customer: ${input.customerId}`);

    const { paymentId } = await this.commandBus.execute<
      CreatePaymentCommand,
      CreatePaymentResult
    >(
      new CreatePaymentCommand({
        customerId: input.customerId,
        amount: input.amount,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
        description: input.description,
        metadata: input.metadata,
      }),
    );

    return this.mutationResponseGraphQLMapper.toResponseDto({
      success: true,
      message: 'Payment created successfully',
      id: paymentId,
    });
  }

  @Mutation(() => MutationResponseDto)
  async refundPayment(
    @Args('input') input: RefundPaymentRequestDto,
  ): Promise<MutationResponseDto> {
    this.logger.log(`Refunding payment ${input.id}`);

    await this.commandBus.execute(
      new RefundPaymentCommand({
        paymentId: input.id,
        amount: input.amount,
        reason: input.reason,
      }),
    );

    return this.mutationResponseGraphQLMapper.toResponseDto({
      success: true,
      message: 'Payment refunded successfully',
      id: input.id,
    });
  }
}
