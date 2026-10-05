import { describe, it, expect } from 'vitest';
import { compareValues, economicValue, nextSort, sortRows } from '../../web/lib/table-sort';

describe('table sorting', () => {
  it('cycles ascending, descending, default and starts a new column ascending', () => {
    const asc = nextSort(null, 2);
    expect(asc).toEqual({ column: 2, direction: 'asc' });
    const desc = nextSort(asc, 2);
    expect(desc).toEqual({ column: 2, direction: 'desc' });
    expect(nextSort(desc, 2)).toBeNull();
    expect(nextSort(desc, 1)).toEqual({ column: 1, direction: 'asc' });
  });
  it('sorts signed raw values without rounding and restores the current source order', () => {
    const rows = [10, -2, 1.004, 1.003, 0];
    expect(sortRows(rows, { column: 0, direction: 'asc' }, n => n)).toEqual([-2, 0, 1.003, 1.004, 10]);
    expect(sortRows(rows, { column: 0, direction: 'desc' }, n => n)).toEqual([10, 1.004, 1.003, 0, -2]);
    expect(sortRows(rows, null, n => n)).toEqual(rows);
    expect(rows).toEqual([10, -2, 1.004, 1.003, 0]);
  });
  it('keeps missing quotes last in both directions and preserves ties', () => {
    const rows = [{ id: 'missing', v: null }, { id: 'a', v: 0 }, { id: 'b', v: 0 }, { id: 'nan', v: NaN }];
    for (const direction of ['asc', 'desc'] as const) {
      expect(sortRows(rows, { column: 0, direction }, r => r.v).map(r => r.id)).toEqual(['a', 'b', 'missing', 'nan']);
    }
  });
  it('sorts refreshed values using the same selected column', () => {
    const sort = { column: 0, direction: 'desc' } as const;
    const rows = [{ id: 'a', v: 2 }, { id: 'b', v: 1 }];
    expect(sortRows(rows, sort, r => r.v)[0].id).toBe('a');
    expect(sortRows([{ ...rows[0], v: -1 }, rows[1]], sort, r => r.v)[0].id).toBe('b');
  });
  it('compares compound columns without concatenating numbers or summing currencies', () => {
    expect(compareValues(['USD', 20], ['USD', 100], 'asc')).toBeLessThan(0);
    expect(compareValues([2, 10], [2, 9], 'desc')).toBeLessThan(0);
  });
  it('normalizes economic values with magnitude units and percentages', () => {
    expect(economicValue('1.2M')).toBe(1200000);
    expect(economicValue('900K')).toBe(900000);
    expect(economicValue('-2.5%')).toBe(-2.5);
    expect(economicValue('1,234')).toBe(1234);
    expect(economicValue(null)).toBeNull();
  });
});
