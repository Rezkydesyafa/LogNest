import { describe, expect, it } from 'vitest';
import { DEMO_SERVICES } from './config';
import { pickScenario, SCENARIOS } from './scenarios';

describe('SCENARIOS', () => {
  it.each(DEMO_SERVICES)('defines routes for the %s service', (service) => {
    expect(SCENARIOS[service].length).toBeGreaterThan(0);
  });

  it('gives every scenario a route, a failure status, and a positive weight', () => {
    for (const scenarios of Object.values(SCENARIOS)) {
      for (const scenario of scenarios) {
        expect(scenario.path.startsWith('/')).toBe(true);
        expect(scenario.failureStatus).toBeGreaterThanOrEqual(400);
        expect(scenario.failureMessage.length).toBeGreaterThan(0);
        expect(scenario.weight).toBeGreaterThan(0);
      }
    }
  });

  it('keeps failure messages free of volatile ids so they fingerprint together', () => {
    for (const scenarios of Object.values(SCENARIOS)) {
      for (const scenario of scenarios) {
        expect(scenario.failureMessage).not.toMatch(/\b[0-9a-f]{8,}\b/);
      }
    }
  });

  it('covers both the 4xx and 5xx paths so the demo exercises stack traces too', () => {
    const statuses = Object.values(SCENARIOS).flatMap((list) => list.map((s) => s.failureStatus));

    expect(statuses.some((status) => status < 500)).toBe(true);
    expect(statuses.some((status) => status >= 500)).toBe(true);
  });
});

describe('pickScenario', () => {
  const scenarios = SCENARIOS.payment;

  it('returns the first scenario at the bottom of the range', () => {
    expect(pickScenario(scenarios, 0)).toBe(scenarios[0]);
  });

  it('returns the last scenario at the top of the range', () => {
    expect(pickScenario(scenarios, 0.999999)).toBe(scenarios[scenarios.length - 1]);
  });

  it('clamps values outside [0, 1)', () => {
    expect(pickScenario(scenarios, -1)).toBe(scenarios[0]);
    expect(pickScenario(scenarios, 5)).toBe(scenarios[scenarios.length - 1]);
  });

  it('respects the weights over many rolls', () => {
    const counts = new Map<string, number>();

    for (let i = 0; i < 1000; i += 1) {
      const scenario = pickScenario(scenarios, i / 1000);
      counts.set(scenario.path, (counts.get(scenario.path) ?? 0) + 1);
    }

    // /charges carries the highest weight, so it must be picked most often.
    const heaviest = scenarios.reduce((a, b) => (a.weight >= b.weight ? a : b));
    const mostPicked = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

    expect(mostPicked).toBe(heaviest.path);
  });
});
