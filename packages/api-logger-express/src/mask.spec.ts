import { describe, expect, it } from 'vitest';
import { DEFAULT_MASK_FIELDS, maskSensitiveData } from './mask';

describe('maskSensitiveData', () => {
  it('masks the default sensitive keys case-insensitively', () => {
    expect(
      maskSensitiveData({
        Authorization: 'Bearer abc',
        userPassword: 'hunter2',
        refreshToken: 'rt_1',
        COOKIE: 'sid=1',
        clientSecret: 's',
        safe: 'kept',
      }),
    ).toEqual({
      Authorization: '[masked]',
      userPassword: '[masked]',
      refreshToken: '[masked]',
      COOKIE: '[masked]',
      clientSecret: '[masked]',
      safe: 'kept',
    });
  });

  it('walks nested objects and arrays', () => {
    expect(
      maskSensitiveData({ users: [{ name: 'a', password: 'p' }], meta: { nested: { token: 't' } } }),
    ).toEqual({
      users: [{ name: 'a', password: '[masked]' }],
      meta: { nested: { token: '[masked]' } },
    });
  });

  it('passes primitives and null through unchanged', () => {
    expect(maskSensitiveData('plain')).toBe('plain');
    expect(maskSensitiveData(42)).toBe(42);
    expect(maskSensitiveData(null)).toBeNull();
    expect(maskSensitiveData(undefined)).toBeUndefined();
  });

  it('accepts a custom field list', () => {
    expect(maskSensitiveData({ ssn: '1', password: 'p' }, ['ssn'])).toEqual({
      ssn: '[masked]',
      password: 'p',
    });
  });

  it('exposes the default field list', () => {
    expect(DEFAULT_MASK_FIELDS).toContain('password');
    expect(DEFAULT_MASK_FIELDS).toContain('authorization');
  });
});
