import { describe, expect, it } from 'vitest';
import { maskSensitiveData } from './mask';

describe('maskSensitiveData (browser SDK)', () => {
  it('masks sensitive keys before a browser log leaves the page', () => {
    expect(
      maskSensitiveData({
        requestHeaders: { authorization: 'Bearer abc' },
        form: { email: 'a@b.c', password: 'hunter2' },
      }),
    ).toEqual({
      requestHeaders: { authorization: '[masked]' },
      form: { email: 'a@b.c', password: '[masked]' },
    });
  });

  it('leaves primitives untouched', () => {
    expect(maskSensitiveData('plain')).toBe('plain');
    expect(maskSensitiveData(null)).toBeNull();
  });
});
