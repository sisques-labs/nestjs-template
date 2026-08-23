import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { USER_DISPLAY_NAME_MAX_LENGTH } from '@contexts/users/domain/value-objects/user-display-name/user-display-name.vo';

/**
 * `PATCH /users/me` request body. Only `displayName` — `email`,
 * `externalId`, and `tenantId` are derived exclusively from the verified
 * token/resolved tenant and are never client-writable through this
 * endpoint. Any other field in the request body is ignored by
 * class-validator's whitelist stripping (see `main.ts`'s global
 * `ValidationPipe`), not silently applied.
 */
export class UpdateUserProfileDto {
  @ApiProperty({ maxLength: USER_DISPLAY_NAME_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(USER_DISPLAY_NAME_MAX_LENGTH)
  displayName!: string;
}
