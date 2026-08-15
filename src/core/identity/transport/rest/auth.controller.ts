import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
  IDENTITY_PROVIDER,
  IIdentityProvider,
} from '../../application/ports/identity-provider.port';
import { ITokenSet } from '../../application/ports/token-set.interface';
import { LoginDto } from './dtos/login.dto';
import { RefreshTokenDto } from './dtos/refresh-token.dto';
import { TokenSetResponseDto } from './dtos/token-set-response.dto';

/**
 * Backend-proxied login/refresh against the active `IIdentityProvider`.
 * Credentials are forwarded straight to the provider and never logged or
 * persisted — only the submitted email is logged, never the password.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    @Inject(IDENTITY_PROVIDER)
    private readonly identityProvider: IIdentityProvider,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange credentials for a token set via the active provider',
  })
  @ApiResponse({ status: 200, type: TokenSetResponseDto })
  login(@Body() dto: LoginDto): Promise<ITokenSet> {
    this.logger.log(`Login requested for ${dto.email}`);
    return this.identityProvider.login({
      email: dto.email,
      password: dto.password,
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new token set' })
  @ApiResponse({ status: 200, type: TokenSetResponseDto })
  refresh(@Body() dto: RefreshTokenDto): Promise<ITokenSet> {
    this.logger.log('Token refresh requested');
    return this.identityProvider.refreshToken(dto.refreshToken);
  }
}
