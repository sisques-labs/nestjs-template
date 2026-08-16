import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsUUID } from 'class-validator';

@InputType('SubscriptionFindByIdRequestDto')
export class SubscriptionFindByIdRequestDto {
  @Field(() => String, { description: 'UUID of the subscription' })
  @IsUUID()
  @IsNotEmpty()
  id!: string;
}
