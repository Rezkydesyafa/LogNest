# @logmind/api-logger-express

Express middleware for sending API response logs to LogMind AI.

```ts
import { logmindApiLogger } from '@logmind/api-logger-express';

app.use(
  logmindApiLogger({
    apiKey: process.env.LOGMIND_API_KEY,
    serviceName: 'auth-service',
    environment: 'development',
    endpoint: 'http://logmind-api:4000/logs/ingest',
    maskFields: ['password', 'token', 'authorization', 'cookie'],
  }),
);
```

The middleware logs after the response finishes and swallows network errors so the host application keeps running.
