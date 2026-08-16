import { Field, InputType } from '@nestjs/graphql';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

@InputType('RefundPaymentRequestDto')
export class RefundPaymentRequestDto {
  @Field(() => String, { description: 'UUID of the payment to refund' })
  @IsUUID()
  @IsNotEmpty()
  id!: string;

  @Field(() => Number, {
    nullable: true,
    description:
      'Amount to refund in minor units; defaults to the full remaining amount',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  amount?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}
