import { Field, InputType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsEnum,
} from 'class-validator';

import { CurrencyEnum } from '@contexts/payments/domain/enums/currency.enum';

@InputType('CreatePaymentRequestDto')
export class CreatePaymentRequestDto {
  @Field(() => String, { description: 'Opaque customer identifier' })
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @Field(() => Number, { description: 'Amount in integer minor units' })
  @IsInt()
  @IsPositive()
  amount!: number;

  @Field(() => CurrencyEnum)
  @IsEnum(CurrencyEnum)
  currency!: CurrencyEnum;

  @Field(() => String, {
    description: 'Caller-supplied idempotency key',
  })
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
