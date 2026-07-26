import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiCreateDocs, ApiDocs } from '../../common/swagger/docs';
import { CurrentUserPayload } from '../../common/types/auth.types';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/password-reset.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Post('register')
  @ApiCreateDocs('Register a new user and return an access token plus a refresh token.')
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.authService.register(dto, sessionContext(request));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiDocs('Login with email and password.')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, sessionContext(request));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiDocs('Exchange a refresh token for a new access token. The refresh token is rotated.')
  refresh(@Body() dto: RefreshDto, @Req() request: Request) {
    return this.authService.refresh(dto.refreshToken ?? '', sessionContext(request));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiDocs('Revoke the refresh token and deny the current access token.')
  logout(@Body() dto: RefreshDto, @Req() request: Request) {
    return this.authService.logout({
      refreshToken: dto.refreshToken,
      accessToken: bearerToken(request),
    });
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiDocs('Revoke every session for the current user.')
  @UseGuards(JwtAuthGuard)
  logoutAll(@Req() request: Request) {
    return this.authService.logout({ accessToken: bearerToken(request), allSessions: true });
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiDocs('Start a password reset. Always succeeds, so it cannot be used to probe for accounts.')
  forgotPassword(@Body() dto: RequestPasswordResetDto, @Req() request: Request) {
    return this.passwordReset.request(dto.email, { ip: request.ip });
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiDocs('Set a new password with a reset token. Ends every existing session.')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordReset.reset(dto.token, dto.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiDocs('Return the current authenticated user.')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: CurrentUserPayload) {
    return user;
  }
}

/** Recorded on the refresh token so a user can tell their sessions apart. */
function sessionContext(request: Request) {
  return {
    ip: request.ip,
    userAgent: headerValue(request, 'user-agent'),
  };
}

function bearerToken(request: Request) {
  const header = headerValue(request, 'authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

function headerValue(request: Request, name: string) {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
