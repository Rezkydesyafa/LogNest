import { Module } from '@nestjs/common';
import { PinoLogger } from '../../../../../packages/shared/src';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { HashingService } from '../../common/services/hashing.service';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtTokenService } from './jwt-token.service';
import { PasswordResetService } from './password-reset.service';
import { RefreshTokenService } from './refresh-token.service';
import { TokenDenylistService } from './token-denylist.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    JwtTokenService,
    RefreshTokenService,
    PasswordResetService,
    PinoLogger,
    TokenDenylistService,
    HashingService,
  ],
  exports: [AuthService, JwtAuthGuard, RefreshTokenService],
})
export class AuthModule {}
