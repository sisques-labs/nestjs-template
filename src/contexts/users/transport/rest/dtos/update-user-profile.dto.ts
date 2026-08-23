import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

import { USER_DISPLAY_NAME_MAX_LENGTH } from '@contexts/users/domain/value-objects/user-display-name/user-display-name.vo';

/**
 * `PATCH /users/me` request body. `displayName` is required and always
 * applied. `avatarUrl` is genuinely optional — a three-state field: the
 * key entirely absent leaves the stored value untouched, `null` clears
 * it, a URL string sets it (see `UpdateUserProfileCommand`'s doc comment
 * for the same contract on the application side). `@IsOptional()` in
 * class-validator skips the `@IsUrl()` check for both `undefined` and
 * `null`, which is exactly the "don't validate format when there's
 * nothing to validate" behavior this needs.
 *
 * `email`, `externalId`, and `tenantId` are derived exclusively from the
 * verified token/resolved tenant and are never client-writable through
 * this endpoint — any other field in the request body is **rejected**
 * (`400`) by the app's global `ValidationPipe`
 * (`forbidNonWhitelisted: true`, see `main.ts`), not silently stripped.
 */
export class UpdateUserProfileDto {
  @ApiProperty({ maxLength: USER_DISPLAY_NAME_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(USER_DISPLAY_NAME_MAX_LENGTH)
  displayName!: string;

  @ApiProperty({ nullable: true, required: false })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string | null;
}
