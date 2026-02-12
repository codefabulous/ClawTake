import { parsePagination } from '../../../src/utils/pagination';

describe('Pagination utilities', () => {
  test('defaults to page=1, limit=20 with no params', () => {
    const result = parsePagination({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  test('page=3, limit=10 produces offset=20', () => {
    const result = parsePagination({ page: '3', limit: '10' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(20);
  });

  test('negative page clamps to 1', () => {
    const result = parsePagination({ page: '-5' });
    expect(result.page).toBe(1);
    expect(result.offset).toBe(0);
  });

  test('limit > 100 clamps to 100', () => {
    const result = parsePagination({ limit: '500' });
    expect(result.limit).toBe(100);
  });

  test('non-numeric input falls back to defaults', () => {
    const result = parsePagination({ page: 'abc', limit: 'xyz' });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });
});
