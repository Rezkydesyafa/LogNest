import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

type JwtPayload = Record<string, unknown> & {
  exp?: number;
  iat?: number;
};

@Injectable()
export class JwtTokenService {
  constructor(private readonly config: ConfigService) {}

  sign(payload: JwtPayload) {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = Number(this.config.get('JWT_EXPIRES_IN_SECONDS') ?? 86400);
    const header = this.encode({ alg: 'HS256', typ: 'JWT' });
    const body = this.encode({
      ...payload,
      iat: now,
      exp: now + expiresIn,
    });
    const data = `${header}.${body}`;

    return `${data}.${this.signature(data)}`;
  }

  verify<T extends JwtPayload>(token: string): T {
    const [header, body, signature] = token.split('.');

    if (!header || !body || !signature) {
      throw new UnauthorizedException('Invalid token');
    }

    const expectedSignature = this.signature(`${header}.${body}`);
    const expected = Buffer.from(expectedSignature);
    const actual = Buffer.from(signature);

    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException('Invalid token');
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Token expired');
    }

    return payload;
  }

  private encode(value: unknown) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private signature(data: string) {
    return createHmac('sha256', this.secret()).update(data).digest('base64url');
  }

  private secret() {
    const secret = this.config.get<string>('JWT_SECRET');

    if (!secret && this.config.get('NODE_ENV') === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }

    return secret ?? 'logmind-dev-secret-change-me';
  }
}
