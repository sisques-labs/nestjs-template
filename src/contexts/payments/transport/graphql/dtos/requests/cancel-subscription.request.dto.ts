import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

@InputType('CancelSubscriptionRequestDto')
export class CancelSubscriptionRequestDto {
  @Field(() => String, { description: 'UUID of the subscription to cancel' })
  @IsUUID()
  @IsNotEmpty()
  id!: string;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;
}
