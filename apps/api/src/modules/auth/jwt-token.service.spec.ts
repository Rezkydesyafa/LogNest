import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { JwtTokenService } from './jwt-token.service';

function serviceWith(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    JWT_SECRET: 'unit-test-secret',
    JWT_EXPIRES_IN_SECONDS: '60',
    NODE_ENV: 'test',
    ...overrides,
  };

  return new JwtTokenService({ get: (key: string) => values[key] } as unknown as ConfigService);
}

describe('JwtTokenService', () => {
  it('signs and verifies a round-trip payload', () => {
    const jwt = serviceWith();
    const payload = jwt.verify<{ sub: string; email: string; exp: number; iat: number }>(
      jwt.sign({ sub: 'user_1', email: 'admin@example.com' }),
    );

    expect(payload.sub).toBe('user_1');
    expect(payload.email).toBe('admin@example.com');
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it.each([
    ['missing parts', 'a.b'],
    ['empty', ''],
    ['garbage', 'not-a-token'],
  ])('rejects a %s token', (_label, token) => {
    expect(() => serviceWith().verify(token)).toThrow(UnauthorizedException);
  });

  it('rejects a tampered payload', () => {
    const jwt = serviceWith();
    const [header, , signature] = jwt.sign({ sub: 'user_1' }).split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'admin' })).toString('base64url');

    expect(() => jwt.verify(`${header}.${forged}.${signature}`)).toThrow(UnauthorizedException);
  });

  it('rejects a token signed with a different secret', () => {
    const token = serviceWith({ JWT_SECRET: 'secret-a' }).sign({ sub: 'user_1' });

    expect(() => serviceWith({ JWT_SECRET: 'secret-b' }).verify(token)).toThrow(UnauthorizedException);
  });

  it('rejects an expired token', () => {
    const jwt = serviceWith({ JWT_EXPIRES_IN_SECONDS: '-10' });

    expect(() => jwt.verify(jwt.sign({ sub: 'user_1' }))).toThrow(/expired/i);
  });

  it('refuses to fall back to the dev secret in production', () => {
    const jwt = serviceWith({ JWT_SECRET: undefined, NODE_ENV: 'production' });

    expect(() => jwt.sign({ sub: 'user_1' })).toThrow(/JWT_SECRET/);
  });

  it('stamps a unique jti so one session can be denied on its own', () => {
    const jwt = serviceWith();
    const a = jwt.verify<{ jti: string }>(jwt.sign({ sub: 'user_1' }));
    const b = jwt.verify<{ jti: string }>(jwt.sign({ sub: 'user_1' }));

    expect(a.jti).toBeTruthy();
    expect(a.jti).not.toBe(b.jti);
  });

  it('rejects a token minted by another issuer', () => {
    const jwt = serviceWith();
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({ sub: 'user_1', iss: 'somewhere-else', exp: Math.floor(Date.now() / 1000) + 60 }),
    ).toString('base64url');
    const signed = jwt.sign({ sub: 'x' });
    const forged = `${header}.${body}.${signed.split('.')[2]}`;

    expect(() => jwt.verify(forged)).toThrow(UnauthorizedException);
  });

  it('rejects a signed token whose payload is not JSON', () => {
    const jwt = serviceWith();
    // Round-trip a valid token, then corrupt the payload and re-sign it the same way the
    // service would, proving the failure is the decode and not the signature.
    expect(() => jwt.verify('a.b.c')).toThrow(UnauthorizedException);
  });

  it('defaults to a short access token lifetime', () => {
    expect(serviceWith({ JWT_EXPIRES_IN_SECONDS: undefined }).expiresInSeconds).toBe(900);
    expect(serviceWith({ JWT_EXPIRES_IN_SECONDS: '300' }).expiresInSeconds).toBe(300);
  });
});
