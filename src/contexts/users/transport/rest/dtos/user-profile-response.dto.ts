import { ApiProperty } from '@nestjs/swagger';

import { UserViewModel } from '@contexts/users/domain/view-models/user.view-model';

/**
 * `/users/me` response shape. Deliberately excludes `externalId` — the raw
 * IdP `sub` claim is an internal implementation detail, not something a
 * client needs back. Must be built via `fromViewModel()` rather than
 * returning a `UserViewModel` instance directly from a controller method:
 * `UserViewModel`'s fields are private (`_id`, `_tenantId`, ...) backing
 * public getters, so a raw instance would serialize to JSON as those
 * underscore-prefixed own properties instead of the clean shape below.
 */
export class UserProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  email!: string | null;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromViewModel(viewModel: UserViewModel): UserProfileResponseDto {
    const dto = new UserProfileResponseDto();
    dto.id = viewModel.id;
    dto.email = viewModel.email;
    dto.displayName = viewModel.displayName;
    dto.avatarUrl = viewModel.avatarUrl;
    dto.tenantId = viewModel.tenantId;
    dto.createdAt = viewModel.createdAt;
    dto.updatedAt = viewModel.updatedAt;
    return dto;
  }
}
