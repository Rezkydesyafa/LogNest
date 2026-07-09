# @logmind/frontend-logger

Browser SDK for sending frontend errors and failed API requests to LogMind AI.

```ts
import { initLogMindFrontend } from '@logmind/frontend-logger';

initLogMindFrontend({
  apiKey: process.env.NEXT_PUBLIC_LOGMIND_CLIENT_KEY,
  serviceName: 'frontend-dashboard',
  environment: 'development',
  endpoint: 'http://localhost:4000/logs/frontend',
});
```

It captures `window.onerror`, `unhandledrejection`, failed `fetch` calls, page URL, route, user agent, language, and viewport. Network errors are swallowed so logging never crashes the frontend app.
