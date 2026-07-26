export type SnippetInput = {
  apiKey: string;
  endpoint: string;
  serviceName?: string;
  environment?: string;
};

export type Snippet = {
  id: string;
  title: string;
  description: string;
  language: 'bash' | 'yaml' | 'ts';
  code: string;
};

const PLACEHOLDER = 'lm_server_your_key_here';

/**
 * Copy-paste integration snippets for a freshly created server key.
 *
 * The raw key is only shown once, so the snippets are generated at that moment with the key
 * already filled in — the step where most people give up is looking up where it goes.
 */
export function integrationSnippets(input: SnippetInput): Snippet[] {
  const key = input.apiKey || PLACEHOLDER;
  const endpoint = input.endpoint.replace(/\/$/, '');
  const service = input.serviceName || 'payment-service';
  const environment = input.environment || 'production';

  return [
    {
      id: 'curl',
      title: 'Send a test log',
      description: 'Verify the key works before wiring anything up.',
      language: 'bash',
      code: `curl -X POST ${endpoint}/logs/ingest \\
  -H "x-api-key: ${key}" \\
  -H "content-type: application/json" \\
  -d '{
    "sourceType": "manual",
    "serviceName": "${service}",
    "environment": "${environment}",
    "level": "error",
    "message": "Hello from LogMind"
  }'`,
    },
    {
      id: 'docker',
      title: 'Collect Docker logs',
      description: 'Label a container and the agent picks up its stdout and stderr.',
      language: 'yaml',
      code: `services:
  ${service}:
    image: your-image
    labels:
      logmind.enabled: 'true'
      logmind.service: '${service}'
      logmind.environment: '${environment}'

  logmind-agent:
    image: logmind-agent
    environment:
      LOGMIND_API_KEY: '${key}'
      LOGMIND_INGEST_ENDPOINT: '${endpoint}/logs/ingest'
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock`,
    },
    {
      id: 'express',
      title: 'Log Express requests',
      description: 'Records method, path, status, duration, and errors.',
      language: 'ts',
      code: `import { logmindApiLogger } from '@logmind/api-logger-express';

app.use(
  logmindApiLogger({
    apiKey: process.env.LOGMIND_API_KEY, // ${key}
    serviceName: '${service}',
    environment: '${environment}',
    endpoint: '${endpoint}/logs/ingest',
  }),
);`,
    },
    {
      id: 'browser',
      title: 'Capture browser errors',
      description: 'Needs a client key, not this server key.',
      language: 'ts',
      code: `import { initLogMindFrontend } from '@logmind/frontend-logger';

initLogMindFrontend({
  apiKey: process.env.NEXT_PUBLIC_LOGMIND_CLIENT_KEY,
  serviceName: 'frontend',
  environment: '${environment}',
  endpoint: '${endpoint}/logs/frontend',
});`,
    },
  ];
}

export type OnboardingStep = {
  id: 'project' | 'apiKey' | 'firstLog';
  title: string;
  description: string;
  done: boolean;
};

/** Drives the checklist shown until a project is actually receiving logs. */
export function onboardingSteps(state: {
  hasProject: boolean;
  hasServerKey: boolean;
  hasLogs: boolean;
}): OnboardingStep[] {
  return [
    {
      id: 'project',
      title: 'Create a project',
      description: 'Groups the services, logs, and incidents that belong together.',
      done: state.hasProject,
    },
    {
      id: 'apiKey',
      title: 'Create a server API key',
      description: 'Authenticates every log your services send. Shown once.',
      done: state.hasServerKey,
    },
    {
      id: 'firstLog',
      title: 'Send your first log',
      description: 'Paste one of the snippets, then watch it arrive on the Logs page.',
      done: state.hasLogs,
    },
  ];
}

export function onboardingComplete(steps: OnboardingStep[]) {
  return steps.every((step) => step.done);
}
