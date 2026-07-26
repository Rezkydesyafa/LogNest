import { DemoServiceName } from './config';

export type DemoScenario = {
  /** Route this scenario exercises, relative to the service root. */
  path: string;
  method: 'GET' | 'POST';
  /** Body sent by the traffic generator. Contains fake secrets on purpose: they prove redaction works. */
  body?: Record<string, unknown>;
  /** Status returned on the failure path. */
  failureStatus: number;
  /** Message logged on the failure path. Stays constant so it fingerprints into one incident. */
  failureMessage: string;
  /** Weight in the traffic mix; higher means more frequent. */
  weight: number;
};

/**
 * Realistic-looking routes per demo service.
 *
 * Failure messages are deliberately stable: the fingerprinter normalises volatile ids, so
 * a repeated failure here collapses into one incident, which is the whole point of the demo.
 */
export const SCENARIOS: Record<DemoServiceName, DemoScenario[]> = {
  auth: [
    {
      path: '/login',
      method: 'POST',
      body: { email: 'demo@example.com', password: 'hunter2' },
      failureStatus: 401,
      failureMessage: 'Invalid credentials for demo login',
      weight: 5,
    },
    {
      path: '/register',
      method: 'POST',
      body: { email: 'new-user@example.com', password: 'hunter2', token: 'invite_abc123xyz' },
      failureStatus: 409,
      failureMessage: 'Email is already registered',
      weight: 2,
    },
    {
      path: '/session',
      method: 'GET',
      failureStatus: 500,
      failureMessage: 'Session store connection timeout',
      weight: 3,
    },
  ],
  payment: [
    {
      path: '/charges',
      method: 'POST',
      body: { orderId: 'order_1', amount: 125000, card: '4242424242424242' },
      failureStatus: 502,
      failureMessage: 'Payment gateway timeout after 30s',
      weight: 6,
    },
    {
      path: '/refunds',
      method: 'POST',
      body: { chargeId: 'ch_1', amount: 125000 },
      failureStatus: 422,
      failureMessage: 'Refund exceeds the original charge amount',
      weight: 2,
    },
    {
      path: '/balance',
      method: 'GET',
      failureStatus: 503,
      failureMessage: 'Ledger read replica unavailable',
      weight: 2,
    },
  ],
  order: [
    {
      path: '/orders',
      method: 'POST',
      body: { sku: 'SKU-1', quantity: 2 },
      failureStatus: 409,
      failureMessage: 'Out of stock for the requested sku',
      weight: 5,
    },
    {
      path: '/orders',
      method: 'GET',
      failureStatus: 500,
      failureMessage: 'Order database connection timeout',
      weight: 4,
    },
    {
      path: '/shipping-quote',
      method: 'POST',
      body: { postcode: '40115', weightKg: 3 },
      failureStatus: 504,
      failureMessage: 'Shipping partner did not respond in time',
      weight: 2,
    },
  ],
};

/** Picks a scenario using the configured weights, given a value in [0, 1). */
export function pickScenario(scenarios: DemoScenario[], roll: number) {
  const total = scenarios.reduce((sum, scenario) => sum + scenario.weight, 0);
  let cursor = Math.min(Math.max(roll, 0), 0.999999) * total;

  for (const scenario of scenarios) {
    cursor -= scenario.weight;
    if (cursor < 0) return scenario;
  }

  return scenarios[scenarios.length - 1];
}
