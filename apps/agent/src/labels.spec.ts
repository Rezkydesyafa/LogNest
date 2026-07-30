import { describe, expect, it } from 'vitest';
import {
  environmentFromLabels,
  isAgentContainer,
  isLogmindEnabled,
  serviceNameFromLabels,
  shouldWatchContainer,
} from './labels';

describe('isLogmindEnabled', () => {
  it('only treats the exact string "true" as enabled', () => {
    expect(isLogmindEnabled({ 'logmind.enabled': 'true' })).toBe(true);
    expect(isLogmindEnabled({ 'logmind.enabled': 'false' })).toBe(false);
    expect(isLogmindEnabled({ 'logmind.enabled': 'TRUE' })).toBe(false);
    expect(isLogmindEnabled({})).toBe(false);
  });
});

describe('shouldWatchContainer', () => {
  it('opts in explicitly labelled containers', () => {
    expect(shouldWatchContainer({ 'logmind.enabled': 'true' }, [], [])).toBe(true);
  });

  it('lets an explicit opt-out win over the compose allowlist', () => {
    expect(
      shouldWatchContainer(
        {
          'logmind.enabled': 'false',
          'com.docker.compose.project': 'docker',
          'com.docker.compose.service': 'backend',
        },
        ['docker'],
        ['backend'],
      ),
    ).toBe(false);
  });

  it('matches the compose project and service allowlist', () => {
    const labels = {
      'com.docker.compose.project': 'docker',
      'com.docker.compose.service': 'backend',
    };

    expect(shouldWatchContainer(labels, ['docker'], ['backend'])).toBe(true);
    expect(shouldWatchContainer(labels, ['docker'], ['worker'])).toBe(false);
    expect(shouldWatchContainer(labels, ['other'], ['backend'])).toBe(false);
  });

  it('matches every service when the service allowlist is empty', () => {
    expect(
      shouldWatchContainer(
        { 'com.docker.compose.project': 'docker', 'com.docker.compose.service': 'anything' },
        ['docker'],
        [],
      ),
    ).toBe(true);
  });

  it('ignores unlabelled containers with no allowlist match', () => {
    expect(shouldWatchContainer({}, ['docker'], ['backend'])).toBe(false);
  });

  it('watches every container with wildcard discovery except excluded projects', () => {
    expect(shouldWatchContainer({}, ['*'], [], ['logmind'])).toBe(true);
    expect(shouldWatchContainer({ 'com.docker.compose.project': 'sakoo' }, ['*'], [], ['logmind'])).toBe(
      true,
    );
    expect(shouldWatchContainer({ 'com.docker.compose.project': 'logmind' }, ['*'], [], ['logmind'])).toBe(
      false,
    );
  });
});

describe('isAgentContainer', () => {
  it('detects the agent by label', () => {
    expect(isAgentContainer('abcdef', { 'logmind.agent': 'true' })).toBe(true);
  });

  it('detects the agent by its own container id prefix', () => {
    expect(isAgentContainer('abcdef', {}, 'abc')).toBe(true);
    expect(isAgentContainer('abcdef', {}, 'xyz')).toBe(false);
    expect(isAgentContainer('abcdef', {})).toBe(false);
  });
});

describe('label fallbacks', () => {
  it('prefers the logmind label, then the compose label, then the fallback', () => {
    expect(serviceNameFromLabels({ 'logmind.service': 'payment-service' }, 'fallback')).toBe(
      'payment-service',
    );
    expect(serviceNameFromLabels({ 'com.docker.compose.service': 'api' }, 'fallback')).toBe('api');
    expect(serviceNameFromLabels({}, 'fallback')).toBe('fallback');
  });

  it('resolves the environment with a default', () => {
    expect(environmentFromLabels({ 'logmind.environment': 'production' })).toBe('production');
    expect(environmentFromLabels({})).toBe('development');
    expect(environmentFromLabels({}, 'staging')).toBe('staging');
  });
});
