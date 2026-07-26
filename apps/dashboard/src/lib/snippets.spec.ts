import { describe, expect, it } from 'vitest';
import { integrationSnippets, onboardingComplete, onboardingSteps } from './snippets';

const input = {
  apiKey: 'lm_server_abc123',
  endpoint: 'https://logmind.example.com/backend',
  serviceName: 'checkout',
  environment: 'staging',
};

describe('integrationSnippets', () => {
  it('covers curl, Docker, Express, and the browser SDK', () => {
    expect(integrationSnippets(input).map((s) => s.id)).toEqual(['curl', 'docker', 'express', 'browser']);
  });

  it('fills the real key into the server-side snippets', () => {
    const snippets = integrationSnippets(input);

    expect(snippets.find((s) => s.id === 'curl')!.code).toContain('lm_server_abc123');
    expect(snippets.find((s) => s.id === 'docker')!.code).toContain('lm_server_abc123');
  });

  it('never puts the server key in the browser snippet', () => {
    const browser = integrationSnippets(input).find((s) => s.id === 'browser')!;

    expect(browser.code).not.toContain('lm_server_abc123');
    expect(browser.code).toContain('NEXT_PUBLIC_LOGMIND_CLIENT_KEY');
  });

  it('uses the project service name and environment throughout', () => {
    for (const snippet of integrationSnippets(input)) {
      if (snippet.id === 'browser') continue;
      expect(snippet.code).toContain('checkout');
      expect(snippet.code).toContain('staging');
    }
  });

  it('normalises a trailing slash on the endpoint', () => {
    const snippets = integrationSnippets({ ...input, endpoint: 'https://logmind.example.com/' });

    expect(snippets[0].code).toContain('https://logmind.example.com/logs/ingest');
    expect(snippets[0].code).not.toContain('.com//logs');
  });

  it('falls back to a visible placeholder when no key is available yet', () => {
    expect(integrationSnippets({ ...input, apiKey: '' })[0].code).toContain('lm_server_your_key_here');
  });

  it('falls back to sensible defaults for service and environment', () => {
    const snippet = integrationSnippets({ apiKey: 'k', endpoint: 'http://localhost:3000' })[0];

    expect(snippet.code).toContain('payment-service');
    expect(snippet.code).toContain('production');
  });
});

describe('onboardingSteps', () => {
  it('starts with everything undone', () => {
    const steps = onboardingSteps({ hasProject: false, hasServerKey: false, hasLogs: false });

    expect(steps.map((step) => step.done)).toEqual([false, false, false]);
    expect(onboardingComplete(steps)).toBe(false);
  });

  it('marks each step from the observed state', () => {
    const steps = onboardingSteps({ hasProject: true, hasServerKey: true, hasLogs: false });

    expect(steps.map((step) => step.done)).toEqual([true, true, false]);
    expect(onboardingComplete(steps)).toBe(false);
  });

  it('is complete once logs are arriving', () => {
    const steps = onboardingSteps({ hasProject: true, hasServerKey: true, hasLogs: true });

    expect(onboardingComplete(steps)).toBe(true);
  });

  it('keeps the steps in the order they must be done', () => {
    const steps = onboardingSteps({ hasProject: false, hasServerKey: false, hasLogs: false });

    expect(steps.map((step) => step.id)).toEqual(['project', 'apiKey', 'firstLog']);
  });
});
