import { execFileSync } from 'child_process';
import { MongoDBContainer, StartedMongoDBContainer } from '@testcontainers/mongodb';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';

let postgres: StartedPostgreSqlContainer | undefined;
let mongo: StartedMongoDBContainer | undefined;
let redis: StartedRedisContainer | undefined;

/**
 * Boots one Postgres, MongoDB, and Redis for the whole integration run and applies the real
 * migrations to them.
 *
 * Running `prisma migrate deploy` here is deliberate: the migrations are hand-written SQL,
 * so this is the only place that proves they actually apply and match the Prisma schema.
 */
export async function setup() {
  [postgres, mongo, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:16-alpine').start(),
    new MongoDBContainer('mongo:7').start(),
    new RedisContainer('redis:7-alpine').start(),
  ]);

  // directConnection: the container runs a single-node replica set, and the driver would
  // otherwise try to reach it by its internal hostname.
  const mongoUrl = `${mongo.getConnectionString()}/logmind_test?directConnection=true`;

  process.env.DATABASE_URL = postgres.getConnectionUri();
  process.env.MONGODB_URL = mongoUrl;
  process.env.REDIS_URL = redis.getConnectionUrl();
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'integration-test-secret';
  process.env.ALERT_ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.AI_PROVIDER_MODE = 'mock';
  process.env.AUTO_ANALYSIS_ENABLED = 'false';
  process.env.LOG_LEVEL = 'silent';

  execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], {
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  return async () => {
    await Promise.allSettled([postgres?.stop(), mongo?.stop(), redis?.stop()]);
  };
}
