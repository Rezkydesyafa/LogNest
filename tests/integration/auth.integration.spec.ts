import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomSuffix, startApi, TestApi } from './harness';

let api: TestApi;

beforeAll(async () => {
  api = await startApi();
});

afterAll(async () => {
  await api?.close();
});

async function register() {
  const email = `auth-${randomSuffix()}@example.com`;
  const response = await api
    .http()
    .post('/auth/register')
    .send({ email, password: 'password123' })
    .expect(201);

  return { email, ...(response.body.data as { accessToken: string; refreshToken: string }) };
}

describe('registration and login', () => {
  it('issues an access token and a refresh token', async () => {
    const session = await register();

    expect(session.accessToken.split('.')).toHaveLength(3);
    expect(session.refreshToken.length).toBeGreaterThan(20);
  });

  it('rejects a duplicate email', async () => {
    const session = await register();

    await api
      .http()
      .post('/auth/register')
      .send({ email: session.email, password: 'password123' })
      .expect(409);
  });

  it('logs in with the right password and rejects the wrong one', async () => {
    const session = await register();

    await api.http().post('/auth/login').send({ email: session.email, password: 'password123' }).expect(200);
    await api.http().post('/auth/login').send({ email: session.email, password: 'nope' }).expect(401);
  });

  it('never stores the password in a readable form', async () => {
    const session = await register();
    const user = await api.prisma.user.findUnique({ where: { email: session.email } });

    expect(user?.passwordHash).not.toContain('password123');
    expect(user?.passwordHash.startsWith('scrypt$v1$')).toBe(true);
  });
});

describe('authenticated access', () => {
  it('resolves the current user from the access token', async () => {
    const session = await register();
    const response = await api
      .http()
      .get('/auth/me')
      .set('authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    expect(response.body.data.email).toBe(session.email);
  });

  it.each([
    ['missing header', undefined],
    ['not a bearer token', 'Token abc'],
    ['garbage token', 'Bearer not-a-jwt'],
  ])('rejects a request with a %s', async (_label, header) => {
    const call = api.http().get('/auth/me');
    if (header) call.set('authorization', header);

    await call.expect(401);
  });
});

describe('refresh token rotation', () => {
  it('exchanges a refresh token for a new pair', async () => {
    const session = await register();
    const response = await api
      .http()
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(200);

    expect(response.body.data.refreshToken).not.toBe(session.refreshToken);
    await api
      .http()
      .get('/auth/me')
      .set('authorization', `Bearer ${response.body.data.accessToken}`)
      .expect(200);
  });

  it('revokes the whole family when a spent token is replayed', async () => {
    const session = await register();
    const first = await api
      .http()
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(200);

    // Replaying the original token is the signal that it leaked.
    await api.http().post('/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);

    // Its legitimate successor is revoked too.
    await api.http().post('/auth/refresh').send({ refreshToken: first.body.data.refreshToken }).expect(401);
  });

  it('stores refresh tokens hashed, never in the clear', async () => {
    const session = await register();
    const rows = await api.prisma.refreshToken.findMany();

    expect(rows.some((row) => row.tokenHash === session.refreshToken)).toBe(false);
    expect(rows.every((row) => /^[0-9a-f]{64}$/.test(row.tokenHash))).toBe(true);
  });
});

describe('logout', () => {
  it('denies the access token immediately, before it expires', async () => {
    const session = await register();

    await api.http().get('/auth/me').set('authorization', `Bearer ${session.accessToken}`).expect(200);

    await api
      .http()
      .post('/auth/logout')
      .set('authorization', `Bearer ${session.accessToken}`)
      .send({ refreshToken: session.refreshToken })
      .expect(200);

    await api.http().get('/auth/me').set('authorization', `Bearer ${session.accessToken}`).expect(401);
  });

  it('revokes the refresh token so it cannot be exchanged afterwards', async () => {
    const session = await register();

    await api
      .http()
      .post('/auth/logout')
      .set('authorization', `Bearer ${session.accessToken}`)
      .send({ refreshToken: session.refreshToken })
      .expect(200);

    await api.http().post('/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
  });

  it('ends every session with logout-all', async () => {
    const session = await register();
    const second = await api
      .http()
      .post('/auth/login')
      .send({ email: session.email, password: 'password123' })
      .expect(200);

    await api
      .http()
      .post('/auth/logout-all')
      .set('authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    await api.http().post('/auth/refresh').send({ refreshToken: second.body.data.refreshToken }).expect(401);
  });
});
