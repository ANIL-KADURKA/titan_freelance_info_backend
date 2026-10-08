import { describe, expect, it } from 'vitest';
import { pageArgs, pageArray, paged } from './pagination.js';

describe('pagination helpers', () => {
  it('defaults and clamps page arguments', () => {
    expect(pageArgs()).toEqual({ page: 1, pageSize: 20, skip: 0, take: 20 });
    expect(pageArgs({ page: 3, pageSize: 10 })).toMatchObject({
      skip: 20,
      take: 10,
    });
    expect(pageArgs({ page: 0, pageSize: 1000 })).toMatchObject({
      page: 1,
      pageSize: 100,
    });
  });

  it('builds meta with total pages', () => {
    expect(paged(['a'], 41, { page: 2, pageSize: 20 }).meta).toEqual({
      page: 2,
      pageSize: 20,
      total: 41,
      totalPages: 3,
    });
  });

  it('pages an in-memory list', () => {
    const result = pageArray([1, 2, 3, 4, 5], { page: 2, pageSize: 2 });
    expect(result.data).toEqual([3, 4]);
    expect(result.meta.total).toBe(5);
  });
});
