import { ApiProperty } from '@nestjs/swagger';

export class TokenSetResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ nullable: true })
  refreshToken!: string | null;

  @ApiProperty()
  expiresIn!: number;
}
