export type LogFilterInput = {
  serviceId?: string;
  sourceType?: string;
  level?: string;
  environment?: string;
  requestId?: string;
  keyword?: string;
  path?: string;
  pageUrl?: string;
  statusCode?: number;
  from?: string;
  to?: string;
};

export type LogQueryFilter = Record<string, unknown>;

/** Matches nothing. Used when the caller owns no project, so the query never scans. */
export const EMPTY_PROJECT_FILTER: LogQueryFilter = { projectId: '__none__' };

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds the MongoDB filter for a log query.
 *
 * Two deliberate choices:
 *  - `keyword` runs through `$text`, which uses the `raw_logs_text` index. The previous
 *    `$regex` search could not use any index and scanned the whole collection.
 *  - `path` and `pageUrl` are anchored prefix regexes (`^value`), which a normal B-tree
 *    index can serve; an unanchored `/value/i` cannot.
 */
export function buildLogFilter(projectIds: string[], query: LogFilterInput = {}): LogQueryFilter {
  if (!projectIds.length) return { ...EMPTY_PROJECT_FILTER };

  const filter: LogQueryFilter = {
    projectId: projectIds.length === 1 ? projectIds[0] : { $in: projectIds },
  };

  if (query.serviceId) filter.serviceId = query.serviceId;
  if (query.sourceType) filter.sourceType = query.sourceType;
  if (query.level) filter.level = query.level;
  if (query.environment) filter.environment = query.environment;
  if (query.requestId) filter.requestId = query.requestId;
  if (query.statusCode !== undefined) filter['api.statusCode'] = query.statusCode;
  if (query.path) filter['api.path'] = prefixMatch(query.path);
  if (query.pageUrl) filter['frontend.pageUrl'] = prefixMatch(query.pageUrl);

  const from = validDate(query.from);
  const to = validDate(query.to);
  if (from || to) {
    filter.timestamp = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }

  const keyword = query.keyword?.trim();
  if (keyword) filter.$text = { $search: keyword };

  return filter;
}

export type LogSort = Record<string, -1 | 1 | { $meta: 'textScore' }>;

/** `$text` scores results, so a text query sorts by relevance first, then recency. */
export function logSort(query: LogFilterInput = {}): LogSort {
  return query.keyword?.trim()
    ? { score: { $meta: 'textScore' }, timestamp: -1 }
    : { timestamp: -1, createdAt: -1 };
}

function prefixMatch(value: string) {
  return { $regex: `^${escapeRegex(value)}`, $options: 'i' };
}

function validDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
