import { describe, expect, it } from 'vitest';
import { loadDemoConfig } from './config';

describe('loadDemoConfig', () => {
  it('defaults to the auth service', () => {
    expect(loadDemoConfig({})).toMatchObject({
      service: 'auth',
      serviceName: 'demo-auth-service',
      environment: 'development',
      port: 4000,
      trafficEnabled: true,
      errorRate: 0.25,
    });
  });

  it.each(['payment', 'order', 'PAYMENT'])('selects the %s service', (value) => {
    expect(loadDemoConfig({ DEMO_SERVICE: value }).service).toBe(value.toLowerCase());
  });

  it('falls back to auth for an unknown service', () => {
    expect(loadDemoConfig({ DEMO_SERVICE: 'billing' }).service).toBe('auth');
  });

  it('derives the reported service name but allows an override', () => {
    expect(loadDemoConfig({ DEMO_SERVICE: 'order' }).serviceName).toBe('demo-order-service');
    expect(loadDemoConfig({ DEMO_SERVICE_NAME: 'checkout' }).serviceName).toBe('checkout');
  });

  it('turns traffic off only for the explicit false', () => {
    expect(loadDemoConfig({ DEMO_TRAFFIC_ENABLED: 'false' }).trafficEnabled).toBe(false);
    expect(loadDemoConfig({ DEMO_TRAFFIC_ENABLED: 'true' }).trafficEnabled).toBe(true);
    expect(loadDemoConfig({}).trafficEnabled).toBe(true);
  });

  it('clamps the error rate to a fraction and falls back on nonsense', () => {
    expect(loadDemoConfig({ DEMO_ERROR_RATE: '0' }).errorRate).toBe(0);
    expect(loadDemoConfig({ DEMO_ERROR_RATE: '1' }).errorRate).toBe(1);
    expect(loadDemoConfig({ DEMO_ERROR_RATE: '5' }).errorRate).toBe(0.25);
    expect(loadDemoConfig({ DEMO_ERROR_RATE: 'lots' }).errorRate).toBe(0.25);
  });

  it('reads the ingestion endpoint and key', () => {
    const config = loadDemoConfig({
      LOGMIND_INGEST_ENDPOINT: 'http://api:3000/logs/ingest',
      LOGMIND_API_KEY: 'lm_server_x',
    });

    expect(config.logmindEndpoint).toBe('http://api:3000/logs/ingest');
    expect(config.logmindApiKey).toBe('lm_server_x');
  });
});
