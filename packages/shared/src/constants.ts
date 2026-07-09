export const LOG_PROCESSING_QUEUE = 'log-processing';
export const REQUEST_ID_HEADER = 'x-request-id';
export const DEFAULT_DATABASE_URL =
  'postgresql://logmind:logmind@localhost:5432/logmind?schema=public';
export const DEFAULT_MONGODB_URL = 'mongodb://localhost:27017/logmind';
export const DEFAULT_REDIS_URL = 'redis://localhost:6379';

export const LOG_SOURCE_TYPES = ['docker', 'api', 'frontend', 'worker', 'manual'] as const;
export const SERVER_LOG_SOURCE_TYPES = ['docker', 'api', 'worker', 'manual'] as const;
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
