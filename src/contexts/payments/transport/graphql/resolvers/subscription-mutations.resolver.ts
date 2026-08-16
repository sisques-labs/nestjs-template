import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  MutationResponseDto,
  MutationResponseGraphQLMapper,
} from '@sisques-labs/nestjs-kit/graphql';

import { CancelSubscriptionCommand } from '@contexts/payments/application/commands/cancel-subscription/cancel-subscription.command';
import { CreateSubscriptionCommand } from '@contexts/payments/application/commands/create-subscription/create-subscription.command';
import { CreateSubscriptionResult } from '@contexts/payments/application/commands/create-subscription/create-subscription.result';
import { CancelSubscriptionRequestDto } from '@contexts/payments/transport/graphql/dtos/requests/cancel-subscription.request.dto';
import { CreateSubscriptionRequestDto } from '@contexts/payments/transport/graphql/dtos/requests/create-subscription.request.dto';

@Resolver()
export class SubscriptionMutationsResolver {
  private readonly logger = new Logger(SubscriptionMutationsResolver.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly mutationResponseGraphQLMapper: MutationResponseGraphQLMapper,
  ) {}

  @Mutation(() => MutationResponseDto)
  async createSubscription(
    @Args('input') input: CreateSubscriptionRequestDto,
  ): Promise<MutationResponseDto> {
    this.logger.log(`Creating subscription for customer: ${input.customerId}`);

    const { subscriptionId } = await this.commandBus.execute<
      CreateSubscriptionCommand,
      CreateSubscriptionResult
    >(
      new CreateSubscriptionCommand({
        customerId: input.customerId,
        priceId: input.priceId,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata,
      }),
    );

    return this.mutationResponseGraphQLMapper.toResponseDto({
      success: true,
      message: 'Subscription created successfully',
      id: subscriptionId,
    });
  }

  @Mutation(() => MutationResponseDto)
  async cancelSubscription(
    @Args('input') input: CancelSubscriptionRequestDto,
  ): Promise<MutationResponseDto> {
    this.logger.log(`Canceling subscription ${input.id}`);

    await this.commandBus.execute(
      new CancelSubscriptionCommand({
        subscriptionId: input.id,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      }),
    );

    return this.mutationResponseGraphQLMapper.toResponseDto({
      success: true,
      message: 'Subscription cancellation recorded',
      id: input.id,
    });
  }
}
