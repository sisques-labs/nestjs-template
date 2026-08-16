import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({
    example: 'cus_123',
    description: 'Opaque customer identifier',
  })
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @ApiProperty({ example: 'price_pro_monthly' })
  @IsString()
  @IsNotEmpty()
  priceId!: string;

  @ApiProperty({
    example: 'a1b2c3',
    description:
      'Caller-supplied idempotency key — retrying with the same key returns the original subscription',
  })
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @ApiPropertyOptional({ example: { plan: 'pro' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
