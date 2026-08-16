import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreatePaymentDto {
  @ApiProperty({
    example: 'cus_123',
    description: 'Opaque customer identifier',
  })
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @ApiProperty({
    example: 1500,
    description: 'Amount in integer minor units (e.g. cents)',
  })
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiProperty({ enum: CurrencyEnum, example: CurrencyEnum.USD })
  @IsEnum(CurrencyEnum)
  currency!: CurrencyEnum;

  @ApiProperty({
    example: 'a1b2c3',
    description:
      'Caller-supplied idempotency key — retrying with the same key returns the original payment',
  })
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @ApiPropertyOptional({ example: 'Order #1042' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: { orderId: '1042' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
