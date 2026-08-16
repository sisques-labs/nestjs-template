import { Field, ID, ObjectType } from '@nestjs/graphql';
import { BasePaginatedResultDto } from '@sisques-labs/nestjs-kit/graphql';
import GraphQLJSON from 'graphql-type-json';

import { CurrencyEnum } from '@contexts/payments/domain/enums/currency.enum';
import { PaymentProviderEnum } from '@contexts/payments/domain/enums/payment-provider.enum';
import { PaymentStatusEnum } from '@contexts/payments/domain/enums/payment-status.enum';

@ObjectType('PaymentResponseDto')
export class PaymentResponseDto {
  @Field(() => ID, { description: 'UUID of the payment' })
  id!: string;

  @Field(() => PaymentProviderEnum)
  provider!: PaymentProviderEnum;

  @Field(() => String, { nullable: true })
  providerPaymentId?: string;

  @Field(() => String)
  customerId!: string;

  @Field(() => Number, { description: 'Amount in integer minor units' })
  amount!: number;

  @Field(() => CurrencyEnum)
  currency!: CurrencyEnum;

  @Field(() => PaymentStatusEnum)
  status!: PaymentStatusEnum;

  @Field(() => String)
  idempotencyKey!: string;

  @Field(() => Number)
  refundedAmount!: number;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, unknown>;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('PaginatedPaymentResultDto')
export class PaginatedPaymentResultDto extends BasePaginatedResultDto {
  @Field(() => [PaymentResponseDto])
  items!: PaymentResponseDto[];
}
