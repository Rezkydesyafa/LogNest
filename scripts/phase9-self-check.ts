import { strict as assert } from 'assert';
import { loadConfig } from '../apps/agent/src/config';
import {
  environmentFromLabels,
  isAgentContainer,
  isLogmindEnabled,
  serviceNameFromLabels,
} from '../apps/agent/src/labels';
import { LineBuffer } from '../apps/agent/src/line-buffer';
import { LogMindClient } from '../apps/agent/src/logmind-client';

async function main() {
  assert.equal(isLogmindEnabled({ 'logmind.enabled': 'true' }), true);
  assert.equal(isLogmindEnabled({ 'logmind.enabled': 'false' }), false);
  assert.equal(isAgentContainer('abcdef', { 'logmind.agent': 'true' }), true);
  assert.equal(isAgentContainer('abcdef', {}, 'abc'), true);
  assert.equal(serviceNameFromLabels({ 'logmind.service': 'payment-service' }, 'fallback'), 'payment-service');
  assert.equal(environmentFromLabels({ 'logmind.environment': 'production' }), 'production');

  assert.deepEqual(loadConfig({ LOGMIND_AGENT_RETRY_ATTEMPTS: 'bad' }).retryAttempts, 3);

  const buffer = new LineBuffer();
  assert.deepEqual(buffer.push('line 1\nline'), ['line 1']);
  assert.deepEqual(buffer.push(' 2\r\n'), ['line 2']);
  assert.deepEqual(buffer.flush(), []);

  let attempts = 0;
  const client = new LogMindClient(
    {
      apiKey: 'server-key',
      endpoint: 'http://logmind/logs/ingest',
      retryAttempts: 2,
      retryDelayMs: 1,
    },
    async (_url, init) => {
      attempts += 1;
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers['x-api-key'], 'server-key');
      assert.equal(body.sourceType, 'docker');
      return new Response('{}', { status: attempts === 2 ? 200 : 503 });
    },
  );

  const sent = await client.send({
    sourceType: 'docker',
    serviceName: 'payment-service',
    environment: 'development',
    level: 'error',
    message: 'database timeout',
    timestamp: new Date().toISOString(),
    metadata: { container: { id: 'abc' } },
  });

  assert.equal(sent, true);
  assert.equal(attempts, 2);
  console.log('phase9 self-check passed');
}

void main();
