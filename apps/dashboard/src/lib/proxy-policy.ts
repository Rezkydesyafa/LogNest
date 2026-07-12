const RULES: Array<[string, RegExp]> = [
  ["GET", /^\/projects(?:\/[^/]+)?$/],
  ["POST", /^\/projects$/],
  ["GET", /^\/projects\/[^/]+\/(?:services|api-keys)$/],
  ["POST", /^\/projects\/[^/]+\/api-keys$/],
  ["DELETE", /^\/api-keys\/[^/]+$/],
  ["GET", /^\/services\/[^/]+$/],
  ["GET", /^\/logs(?:\/search|\/[^/]+)?$/],
  ["GET", /^\/services\/[^/]+\/logs$/],
  ["GET", /^\/incidents(?:\/[^/]+|\/[^/]+\/logs)?$/],
  ["PATCH", /^\/incidents\/[^/]+\/status$/],
  ["POST", /^\/incidents\/[^/]+\/analyze$/],
  [
    "GET",
    /^\/dashboard\/(?:summary|services-health|api-performance|frontend-errors)$/,
  ],
];

export function isAllowedProxyRequest(method: string, path: string) {
  return RULES.some(
    ([allowedMethod, pattern]) =>
      allowedMethod === method && pattern.test(path),
  );
}
