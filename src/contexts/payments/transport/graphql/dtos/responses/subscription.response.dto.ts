import { Field, ID, ObjectType } from '@nestjs/graphql';
import { BasePaginatedResultDto } from '@sisques-labs/nestjs-kit/graphql';
import GraphQLJSON from 'graphql-type-json';

import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { SubscriptionStatusEnum } from '@contexts/payments/domain/enums/subscription-status.enum';

@ObjectType('SubscriptionResponseDto')
export class SubscriptionResponseDto {
  @Field(() => ID, { description: 'UUID of the subscription' })
  id!: string;

  @Field(() => PaymentProviderEnum)
  provider!: PaymentProviderEnum;

  @Field(() => String, { nullable: true })
  providerSubscriptionId?: string;

  @Field(() => String, { nullable: true })
  providerCustomerId?: string;

  @Field(() => String)
  customerId!: string;

  @Field(() => String)
  priceId!: string;

  @Field(() => SubscriptionStatusEnum)
  status!: SubscriptionStatusEnum;

  @Field(() => Date, { nullable: true })
  currentPeriodStart?: Date;

  @Field(() => Date, { nullable: true })
  currentPeriodEnd?: Date;

  @Field(() => Boolean)
  cancelAtPeriodEnd!: boolean;

  @Field(() => String)
  idempotencyKey!: string;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, unknown>;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('PaginatedSubscriptionResultDto')
export class PaginatedSubscriptionResultDto extends BasePaginatedResultDto {
  @Field(() => [SubscriptionResponseDto])
  items!: SubscriptionResponseDto[];
}
