import { strict as assert } from 'assert';
import { LOG_LEVELS, LOG_SOURCE_TYPES, SERVER_LOG_SOURCE_TYPES } from '../packages/shared/src/constants';
import { maskSensitiveData } from '../apps/api/src/common/utils/mask-sensitive-data';
import { pagination } from '../apps/api/src/common/utils/pagination';

const masked = maskSensitiveData({
  password: 'secret',
  nested: {
    authorization: 'Bearer token',
    value: 'kept',
  },
  list: [{ cookie: 'session' }],
}) as Record<string, unknown>;

assert.equal(masked.password, '[masked]');
assert.deepEqual(masked.nested, { authorization: '[masked]', value: 'kept' });
assert.deepEqual(masked.list, [{ cookie: '[masked]' }]);
assert.deepEqual(pagination(-1, 500), { page: 1, limit: 100, skip: 0 });
assert.equal(LOG_SOURCE_TYPES.includes('frontend'), true);
assert.equal(SERVER_LOG_SOURCE_TYPES.includes('frontend' as never), false);
assert.equal(LOG_LEVELS.includes('fatal'), true);

console.log('phase3 self-check passed');
