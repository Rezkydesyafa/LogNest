import { describe, expect, it } from 'vitest';
import { buildLogFilter, escapeRegex, EMPTY_PROJECT_FILTER, logSort } from './log-filter';

describe('escapeRegex', () => {
  it('neutralises regex metacharacters', () => {
    expect(escapeRegex('/a.b*c(d)')).toBe('/a\\.b\\*c\\(d\\)');
  });
});

describe('buildLogFilter', () => {
  it('matches nothing when the caller owns no project', () => {
    expect(buildLogFilter([], { keyword: 'timeout' })).toEqual(EMPTY_PROJECT_FILTER);
  });

  it('uses a plain equality for a single project and $in for several', () => {
    expect(buildLogFilter(['p1']).projectId).toBe('p1');
    expect(buildLogFilter(['p1', 'p2']).projectId).toEqual({ $in: ['p1', 'p2'] });
  });

  it('passes through the simple equality filters', () => {
    expect(
      buildLogFilter(['p1'], {
        serviceId: 's1',
        sourceType: 'api',
        level: 'error',
        environment: 'production',
        requestId: 'req_1',
        statusCode: 500,
      }),
    ).toMatchObject({
      serviceId: 's1',
      sourceType: 'api',
      level: 'error',
      environment: 'production',
      requestId: 'req_1',
      'api.statusCode': 500,
    });
  });

  it('keeps a zero status code instead of dropping it as falsy', () => {
    expect(buildLogFilter(['p1'], { statusCode: 0 })['api.statusCode']).toBe(0);
  });

  it('searches keywords through $text so the text index is used', () => {
    expect(buildLogFilter(['p1'], { keyword: '  database timeout  ' }).$text).toEqual({
      $search: 'database timeout',
    });
  });

  it('ignores a blank keyword', () => {
    expect(buildLogFilter(['p1'], { keyword: '   ' }).$text).toBeUndefined();
  });

  it('anchors path and pageUrl so an index can serve them', () => {
    const filter = buildLogFilter(['p1'], { path: '/check.out', pageUrl: 'https://app/x' });

    expect(filter['api.path']).toEqual({ $regex: '^/check\\.out', $options: 'i' });
    expect(filter['frontend.pageUrl']).toEqual({ $regex: '^https://app/x', $options: 'i' });
  });

  it('builds an open ended time range from either bound', () => {
    expect(buildLogFilter(['p1'], { from: '2026-07-26T00:00:00.000Z' }).timestamp).toEqual({
      $gte: new Date('2026-07-26T00:00:00.000Z'),
    });
    expect(buildLogFilter(['p1'], { to: '2026-07-26T23:59:59.000Z' }).timestamp).toEqual({
      $lte: new Date('2026-07-26T23:59:59.000Z'),
    });
    expect(
      buildLogFilter(['p1'], { from: '2026-07-26T00:00:00.000Z', to: '2026-07-27T00:00:00.000Z' }).timestamp,
    ).toEqual({
      $gte: new Date('2026-07-26T00:00:00.000Z'),
      $lte: new Date('2026-07-27T00:00:00.000Z'),
    });
  });

  it('drops an unparseable date instead of building an Invalid Date filter', () => {
    expect(buildLogFilter(['p1'], { from: 'not-a-date' }).timestamp).toBeUndefined();
  });

  it('omits absent filters entirely', () => {
    expect(Object.keys(buildLogFilter(['p1']))).toEqual(['projectId']);
  });
});

describe('logSort', () => {
  it('sorts by recency without a keyword', () => {
    expect(logSort()).toEqual({ timestamp: -1, createdAt: -1 });
  });

  it('sorts by text relevance first when a keyword is present', () => {
    expect(logSort({ keyword: 'timeout' })).toEqual({
      score: { $meta: 'textScore' },
      timestamp: -1,
    });
  });
});
