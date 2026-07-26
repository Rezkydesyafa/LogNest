import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

type JwtPayload = Record<string, unknown> & {
  exp?: number;
  iat?: number;
  jti?: string;
  iss?: string;
};

const ISSUER = 'logmind';
/** Short by design: revocation of an access token relies on it expiring quickly. */
const DEFAULT_ACCESS_TTL_SECONDS = 900;

@Injectable()
export class JwtTokenService {
  constructor(private readonly config: ConfigService) {}

  get expiresInSeconds() {
    const configured = Number(this.config.get('JWT_EXPIRES_IN_SECONDS'));
    return Number.isFinite(configured) && configured !== 0 ? configured : DEFAULT_ACCESS_TTL_SECONDS;
  }

  sign(payload: JwtPayload) {
    const now = Math.floor(Date.now() / 1000);
    const header = this.encode({ alg: 'HS256', typ: 'JWT' });
    const body = this.encode({
      ...payload,
      iss: ISSUER,
      // Unique per token so a single session can be denied without rotating the secret.
      jti: randomBytes(12).toString('base64url'),
      iat: now,
      exp: now + this.expiresInSeconds,
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

    const payload = this.decode<T>(body);

    if (payload.iss !== ISSUER) {
      throw new UnauthorizedException('Invalid token');
    }

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Token expired');
    }

    return payload;
  }

  private decode<T>(body: string): T {
    try {
      return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
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
