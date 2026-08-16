import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsUUID } from 'class-validator';

@InputType('PaymentFindByIdRequestDto')
export class PaymentFindByIdRequestDto {
  @Field(() => String, { description: 'UUID of the payment' })
  @IsUUID()
  @IsNotEmpty()
  id!: string;
}
