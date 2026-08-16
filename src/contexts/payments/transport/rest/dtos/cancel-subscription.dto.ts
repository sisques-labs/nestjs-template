import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class CancelSubscriptionDto {
  @ApiPropertyOptional({
    example: true,
    description:
      'Whether the subscription stays active until the current period ends (default true)',
  })
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;
}
