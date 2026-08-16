import { Field, InputType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

@InputType('CreateSubscriptionRequestDto')
export class CreateSubscriptionRequestDto {
  @Field(() => String, { description: 'Opaque customer identifier' })
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  priceId!: string;

  @Field(() => String, { description: 'Caller-supplied idempotency key' })
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
