import assert from 'node:assert/strict';
import { isAllowedProxyRequest } from '../apps/dashboard/src/lib/proxy-policy';
import { queryString } from '../apps/dashboard/src/lib/api';

assert.equal(isAllowedProxyRequest('GET', '/dashboard/summary'), true);
assert.equal(isAllowedProxyRequest('POST', '/incidents/incident_1/analyze'), true);
assert.equal(isAllowedProxyRequest('POST', '/logs/ingest'), false);
assert.equal(isAllowedProxyRequest('GET', '/../../admin'), false);
assert.equal(queryString({ projectId: 'p1', page: 2, empty: '' }), '?projectId=p1&page=2');

console.log('Dashboard self-check passed');
