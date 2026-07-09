import { strict as assert } from 'assert';
import { HashingService } from '../apps/api/src/common/services/hashing.service';
import { JwtTokenService } from '../apps/api/src/modules/auth/jwt-token.service';

async function main() {
  const hashing = new HashingService();
  const passwordHash = await hashing.hashPassword('password123');

  assert.equal(await hashing.verifyPassword('password123', passwordHash), true);
  assert.equal(await hashing.verifyPassword('wrong-password', passwordHash), false);
  assert.equal(hashing.hashApiKey('lm_server_test'), hashing.hashApiKey('lm_server_test'));

  const jwt = new JwtTokenService({
    get: (key: string) =>
      ({
        JWT_SECRET: 'phase2-test-secret',
        JWT_EXPIRES_IN_SECONDS: '60',
        NODE_ENV: 'test',
      })[key],
  } as never);
  const token = jwt.sign({ sub: 'user_1', email: 'admin@example.com' });
  const payload = jwt.verify<{ sub: string; email: string }>(token);

  assert.equal(payload.sub, 'user_1');
  assert.equal(payload.email, 'admin@example.com');
}

void main().then(() => {
  console.log('phase2 self-check passed');
});
