import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class RefundPaymentDto {
  @ApiPropertyOptional({
    example: 500,
    description:
      'Amount to refund in minor units. Defaults to the full remaining unrefunded amount.',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({ example: 'requested_by_customer' })
  @IsOptional()
  @IsString()
  reason?: string;
}
