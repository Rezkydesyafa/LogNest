import { describe, expect, it } from 'vitest';
import { isAllowedProxyRequest } from './proxy-policy';

describe('isAllowedProxyRequest', () => {
  it.each([
    ['GET', '/projects'],
    ['GET', '/projects/p1'],
    ['POST', '/projects'],
    ['GET', '/projects/p1/api-keys'],
    ['POST', '/projects/p1/api-keys'],
    ['DELETE', '/api-keys/k1'],
    ['GET', '/logs'],
    ['GET', '/logs/search'],
    ['GET', '/services/s1/logs'],
    ['GET', '/incidents'],
    ['GET', '/incidents/i1/logs'],
    ['PATCH', '/incidents/i1/status'],
    ['POST', '/incidents/i1/analyze'],
    ['GET', '/dashboard/summary'],
    ['GET', '/dashboard/services-health'],
    ['GET', '/dashboard/services/service_123'],
    ['GET', '/projects/p1/alert-channels'],
    ['GET', '/projects/p1/alert-rules'],
    ['GET', '/projects/p1/alert-deliveries'],
    ['POST', '/projects/p1/alert-channels'],
    ['POST', '/projects/p1/alert-rules'],
    ['PATCH', '/alert-rules/r1'],
    ['DELETE', '/alert-channels/c1'],
    ['POST', '/alert-channels/c1/test'],
    ['GET', '/projects/p1/audit-logs'],
    ['GET', '/projects/p1/members'],
    ['POST', '/projects/p1/members'],
    ['PATCH', '/projects/members/m1'],
    ['DELETE', '/projects/members/m1'],
  ])('allows %s %s', (method, path) => {
    expect(isAllowedProxyRequest(method, path)).toBe(true);
  });

  it.each([
    ['POST', '/logs/ingest'],
    ['POST', '/logs/frontend'],
    ['GET', '/../../admin'],
    ['DELETE', '/projects/p1'],
    ['GET', '/auth/me'],
    ['POST', '/incidents/i1/status'],
    ['GET', '/dashboard/anything-else'],
    ['GET', '/projects/p1/api-keys/k1'],
    ['POST', '/alert-rules/r1/test'],
    ['DELETE', '/projects/p1/alert-rules'],
    ['GET', '/alert-channels/c1'],
    ['DELETE', '/projects/p1/audit-logs'],
    ['POST', '/projects/members/m1'],
  ])('blocks %s %s', (method, path) => {
    expect(isAllowedProxyRequest(method, path)).toBe(false);
  });
});
