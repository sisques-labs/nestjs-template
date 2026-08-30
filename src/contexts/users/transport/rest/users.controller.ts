import {
  Body,
  Controller,
  Get,
  Logger,
  Patch,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { IPrincipal } from '@core/identity/application/ports/interfaces/principal.interface';
import { CurrentUser } from '@core/identity/infrastructure/decorators/current-user.decorator';
import { IdentityGuard } from '@core/identity/infrastructure/guards/identity.guard';
import { TenantContextService } from '@core/tenancy/application/services/tenant-context.service';
import { TenantContextInterceptor } from '@core/tenancy/infrastructure/interceptors/tenant-context.interceptor';
import { TenantGuard } from '@core/tenancy/infrastructure/guards/tenant.guard';

import { UpdateUserProfileCommand } from '@contexts/users/application/commands/update-user-profile/update-user-profile.command';
import { UpsertUserFromClaimCommand } from '@contexts/users/application/commands/upsert-user-from-claim/upsert-user-from-claim.command';
import { UserViewModel } from '@contexts/users/domain/view-models/user.view-model';
import { UpdateUserProfileDto } from '@contexts/users/transport/rest/dtos/update-user-profile.dto';
import { UserProfileResponseDto } from '@contexts/users/transport/rest/dtos/user-profile-response.dto';

/**
 * Self-service `/users/me` — a caller can only ever read or write their
 * own profile; there is no by-id lookup and no admin surface. This
 * template's first real, production consumer of `@CurrentUser()` — every
 * other guarded route so far exists only in test specs (see
 * `test/identity.e2e-spec.ts`'s `ProtectedTestController`).
 *
 * `UpsertUserFromClaimCommand`/`UpdateUserProfileCommand` are
 * dispatched from here, not from a guard — see
 * `openspec/changes/add-users-context/design.md` decision 4 ("Why not a
 * `UserGuard`") for why: this context's repositories extend
 * `TenantScopedRepository`, which needs `TenantContextService` seeded —
 * only true once `TenantContextInterceptor` has run, i.e. inside the
 * route handler, not inside a guard.
 */
@ApiTags('users')
@Controller('users')
@UseGuards(IdentityGuard, TenantGuard)
@UseInterceptors(TenantContextInterceptor)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly tenantContextService: TenantContextService,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: "Get the caller's own profile, creating it on first request",
  })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  async me(
    @CurrentUser() principal: IPrincipal | undefined,
  ): Promise<UserProfileResponseDto> {
    const currentPrincipal = requirePrincipal(principal);
    this.logger.log(
      `GET /users/me requested for sub "${currentPrincipal.sub}"`,
    );

    const viewModel = await this.commandBus.execute<
      UpsertUserFromClaimCommand,
      UserViewModel
    >(
      new UpsertUserFromClaimCommand({
        tenantId: this.tenantContextService.require(),
        externalId: currentPrincipal.sub,
        email: currentPrincipal.email,
      }),
    );

    return UserProfileResponseDto.fromViewModel(viewModel);
  }

  @Patch('me')
  @ApiOperation({
    summary:
      "Update the caller's own displayName and/or avatarUrl/locale/timezone",
  })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  async updateMe(
    @CurrentUser() principal: IPrincipal | undefined,
    @Body() dto: UpdateUserProfileDto,
  ): Promise<UserProfileResponseDto> {
    const currentPrincipal = requirePrincipal(principal);
    this.logger.log(
      `PATCH /users/me requested for sub "${currentPrincipal.sub}"`,
    );

    const viewModel = await this.commandBus.execute<
      UpdateUserProfileCommand,
      UserViewModel
    >(
      new UpdateUserProfileCommand({
        tenantId: this.tenantContextService.require(),
        externalId: currentPrincipal.sub,
        email: currentPrincipal.email,
        displayName: dto.displayName,
        // `dto.avatarUrl`/`dto.locale`/`dto.timezone` are `undefined` when
        // the request body omits the key entirely (class-transformer never
        // sets it on the instance) — passed through as-is so the command's
        // three-state contract (omitted/null/set) is preserved end to end.
        avatarUrl: dto.avatarUrl,
        locale: dto.locale,
        timezone: dto.timezone,
      }),
    );

    return UserProfileResponseDto.fromViewModel(viewModel);
  }
}

/**
 * `@CurrentUser()` types as `IPrincipal | undefined` since it resolves to
 * `undefined` for a route with no `IdentityGuard` — narrows that away for
 * this controller, where `IdentityGuard` is always present. Only reachable
 * if the guard chain is misconfigured, mirroring `RolesGuard`'s own
 * defensive check for the same case.
 */
function requirePrincipal(principal: IPrincipal | undefined): IPrincipal {
  if (!principal) {
    throw new UnauthorizedException('No authenticated principal on request');
  }
  return principal;
}
