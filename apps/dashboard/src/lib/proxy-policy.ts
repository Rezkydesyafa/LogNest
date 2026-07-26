const RULES: Array<[string, RegExp]> = [
  ['GET', /^\/projects(?:\/[^/]+)?$/],
  ['POST', /^\/projects$/],
  ['GET', /^\/projects\/[^/]+\/(?:services|api-keys)$/],
  ['POST', /^\/projects\/[^/]+\/api-keys$/],
  ['DELETE', /^\/api-keys\/[^/]+$/],
  ['GET', /^\/services\/[^/]+$/],
  ['GET', /^\/logs(?:\/search|\/[^/]+)?$/],
  ['GET', /^\/services\/[^/]+\/logs$/],
  ['GET', /^\/incidents(?:\/[^/]+|\/[^/]+\/logs)?$/],
  ['PATCH', /^\/incidents\/[^/]+\/status$/],
  ['POST', /^\/incidents\/[^/]+\/analyze$/],
  ['GET', /^\/dashboard\/(?:summary|services-health|api-performance|frontend-errors)$/],
  ['GET', /^\/projects\/[^/]+\/(?:alert-channels|alert-rules|alert-deliveries)$/],
  ['POST', /^\/projects\/[^/]+\/(?:alert-channels|alert-rules)$/],
  ['PATCH', /^\/alert-(?:channels|rules)\/[^/]+$/],
  ['DELETE', /^\/alert-(?:channels|rules)\/[^/]+$/],
  ['POST', /^\/alert-channels\/[^/]+\/test$/],
  ['GET', /^\/projects\/[^/]+\/audit-logs$/],
  ['GET', /^\/projects\/[^/]+\/members$/],
  ['POST', /^\/projects\/[^/]+\/members$/],
  ['PATCH', /^\/projects\/members\/[^/]+$/],
  ['DELETE', /^\/projects\/members\/[^/]+$/],
];

export function isAllowedProxyRequest(method: string, path: string) {
  return RULES.some(([allowedMethod, pattern]) => allowedMethod === method && pattern.test(path));
}
