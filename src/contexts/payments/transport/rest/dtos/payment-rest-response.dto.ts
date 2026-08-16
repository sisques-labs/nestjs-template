import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentRestResponseDto {
  @ApiProperty({ description: 'UUID of the payment' })
  id!: string;

  @ApiProperty({ example: 'STRIPE' })
  provider!: string;

  @ApiPropertyOptional({ description: 'Provider-side payment identifier' })
  providerPaymentId?: string;

  @ApiProperty({ example: 'cus_123' })
  customerId!: string;

  @ApiProperty({ example: 1500, description: 'Amount in integer minor units' })
  amount!: number;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ example: 'PENDING' })
  status!: string;

  @ApiProperty()
  idempotencyKey!: string;

  @ApiProperty({ example: 0 })
  refundedAmount!: number;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  metadata?: Record<string, unknown>;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
