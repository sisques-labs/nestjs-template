import { Field, InputType } from '@nestjs/graphql';
import { BaseFindByCriteriaInput } from '@sisques-labs/nestjs-kit/graphql';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';

import { SubscriptionFilterInput } from '@contexts/payments/transport/graphql/dtos/requests/subscription-filter.input';
import { SubscriptionSortInput } from '@contexts/payments/transport/graphql/dtos/requests/subscription-sort.input';

@InputType('SubscriptionFindByCriteriaRequestDto')
export class SubscriptionFindByCriteriaRequestDto extends BaseFindByCriteriaInput {
  @Field(() => [SubscriptionFilterInput], { nullable: true, defaultValue: [] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SubscriptionFilterInput)
  declare filters?: SubscriptionFilterInput[];

  @Field(() => [SubscriptionSortInput], { nullable: true, defaultValue: [] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SubscriptionSortInput)
  declare sorts?: SubscriptionSortInput[];
}
