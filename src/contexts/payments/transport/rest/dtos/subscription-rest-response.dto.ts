import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubscriptionRestResponseDto {
  @ApiProperty({ description: 'UUID of the subscription' })
  id!: string;

  @ApiProperty({ example: 'STRIPE' })
  provider!: string;

  @ApiPropertyOptional()
  providerSubscriptionId?: string;

  @ApiPropertyOptional()
  providerCustomerId?: string;

  @ApiProperty({ example: 'cus_123' })
  customerId!: string;

  @ApiProperty({ example: 'price_pro_monthly' })
  priceId!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiPropertyOptional()
  currentPeriodStart?: Date;

  @ApiPropertyOptional()
  currentPeriodEnd?: Date;

  @ApiProperty({ example: false })
  cancelAtPeriodEnd!: boolean;

  @ApiProperty()
  idempotencyKey!: string;

  @ApiPropertyOptional()
  metadata?: Record<string, unknown>;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
