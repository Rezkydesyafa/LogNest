import { Injectable, UnauthorizedException } from '@nestjs/common';
import { HashingService } from '../../common/services/hashing.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtTokenService } from './jwt-token.service';
import { RefreshContext, RefreshTokenService } from './refresh-token.service';
import { TokenDenylistService } from './token-denylist.service';

type AccessTokenPayload = { sub: string; email: string; jti?: string; exp?: number };

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly hashingService: HashingService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly denylist: TokenDenylistService,
  ) {}

  async register(dto: RegisterDto, context: RefreshContext = {}) {
    const passwordHash = await this.hashingService.hashPassword(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });

    return this.session(user, context);
  }

  async login(dto: LoginDto, context: RefreshContext = {}) {
    const user = await this.usersService.findByEmail(dto.email);
    const isValid = user ? await this.hashingService.verifyPassword(dto.password, user.passwordHash) : false;

    if (!user || !isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.session(user, context);
  }

  /** Exchanges a refresh token for a new pair, rotating the refresh token in the process. */
  async refresh(refreshToken: string, context: RefreshContext = {}) {
    const rotated = await this.refreshTokens.rotate(refreshToken, context);
    const user = await this.usersService.findByIdOrThrow(rotated.userId);

    return {
      user: this.usersService.toPublicUser(user),
      accessToken: this.signAccessToken(user),
      expiresIn: this.jwtTokenService.expiresInSeconds,
      refreshToken: rotated.token,
      refreshExpiresAt: rotated.expiresAt,
    };
  }

  /**
   * Ends a session. The refresh token is revoked in Postgres and the still-valid access
   * token is denied in Redis, so logout takes effect immediately rather than at expiry.
   */
  async logout(input: { refreshToken?: string; accessToken?: string; allSessions?: boolean }) {
    let revoked = 0;

    if (input.accessToken) {
      const payload = this.safeVerify(input.accessToken);

      if (payload?.jti) await this.denylist.deny(payload.jti, payload.exp);
      if (input.allSessions && payload?.sub) {
        revoked += await this.refreshTokens.revokeAllForUser(payload.sub);
      }
    }

    if (input.refreshToken && !input.allSessions) {
      revoked += (await this.refreshTokens.revoke(input.refreshToken)) ? 1 : 0;
    }

    return { loggedOut: true, revokedSessions: revoked };
  }

  async verifyAccessToken(token: string) {
    const payload = this.jwtTokenService.verify<AccessTokenPayload>(token);

    if (await this.denylist.isDenied(payload.jti)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = await this.usersService.findByIdOrThrow(payload.sub);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  private async session(
    user: { id: string; email: string; name: string | null; createdAt: Date },
    context: RefreshContext,
  ) {
    const refresh = await this.refreshTokens.issue(user.id, context);

    return {
      user: this.usersService.toPublicUser(user),
      accessToken: this.signAccessToken(user),
      expiresIn: this.jwtTokenService.expiresInSeconds,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  private signAccessToken(user: { id: string; email: string }) {
    return this.jwtTokenService.sign({ sub: user.id, email: user.email });
  }

  /** Logout must succeed even for a token that is already expired or malformed. */
  private safeVerify(token: string) {
    try {
      return this.jwtTokenService.verify<AccessTokenPayload>(token);
    } catch {
      return undefined;
    }
  }
}
