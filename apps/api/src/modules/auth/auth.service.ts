import { Injectable, UnauthorizedException } from '@nestjs/common';
import { HashingService } from '../../common/services/hashing.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtTokenService } from './jwt-token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly hashingService: HashingService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await this.hashingService.hashPassword(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });

    return this.authResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    const isValid = user
      ? await this.hashingService.verifyPassword(dto.password, user.passwordHash)
      : false;

    if (!user || !isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.authResponse(user);
  }

  async verifyAccessToken(token: string) {
    const payload = this.jwtTokenService.verify<{ sub: string; email: string }>(token);
    const user = await this.usersService.findByIdOrThrow(payload.sub);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  private authResponse(user: { id: string; email: string; name: string | null; createdAt: Date }) {
    return {
      user: this.usersService.toPublicUser(user),
      accessToken: this.jwtTokenService.sign({
        sub: user.id,
        email: user.email,
      }),
    };
  }
}
