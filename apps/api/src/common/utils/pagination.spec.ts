import { describe, expect, it } from 'vitest';
import { pagination } from './pagination';

describe('pagination', () => {
  it('defaults to the first page with 50 items', () => {
    expect(pagination()).toEqual({ page: 1, limit: 50, skip: 0 });
  });

  it('clamps the page to a minimum of 1', () => {
    expect(pagination(0)).toMatchObject({ page: 1, skip: 0 });
    expect(pagination(-5)).toMatchObject({ page: 1, skip: 0 });
  });

  it('clamps the limit between 1 and 100', () => {
    expect(pagination(1, 0).limit).toBe(1);
    expect(pagination(1, 500).limit).toBe(100);
    expect(pagination(1, 25).limit).toBe(25);
  });

  it('computes skip from the clamped values', () => {
    expect(pagination(3, 20).skip).toBe(40);
    expect(pagination(2, 1000).skip).toBe(100);
  });
});
