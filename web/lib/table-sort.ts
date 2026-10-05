export type SortValue = string | number | null | undefined | readonly SortValue[];
export type TableSort = { column: number; direction: "asc" | "desc" } | null;

export function nextSort(current: TableSort, column: number): TableSort {
  if (current?.column !== column) return { column, direction: "asc" };
  return current.direction === "asc" ? { column, direction: "desc" } : null;
}

const missing = (v: SortValue) => v == null || v === "" || (typeof v === "number" && !Number.isFinite(v));
const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });

export function compareValues(a: SortValue, b: SortValue, direction: "asc" | "desc"): number {
  // Missing quotes stay last in both directions; never substitute zero.
  if (missing(a) || missing(b)) return missing(a) === missing(b) ? 0 : missing(a) ? 1 : -1;
  if (Array.isArray(a) || Array.isArray(b)) {
    const left = Array.isArray(a) ? a : [a];
    const right = Array.isArray(b) ? b : [b];
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      const result = compareValues(left[i], right[i], direction);
      if (result) return result;
    }
    return 0;
  }
  const result = typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b));
  return direction === "asc" ? result : -result;
}

export function sortRows<T>(rows: readonly T[], sort: TableSort, value: (row: T, column: number) => SortValue): T[] {
  if (!sort) return [...rows];
  return rows.map((row, index) => ({ row, index })).sort((a, b) =>
    compareValues(value(a.row, sort.column), value(b.row, sort.column), sort.direction) || a.index - b.index
  ).map(({ row }) => row);
}

export function economicValue(value: string | null): SortValue {
  if (!value || value.trim() === "—") return null;
  const normalized = value.trim().replace(/,/g, "");
  const match = normalized.match(/^([+-]?\d*\.?\d+)\s*([KMBT万亿])?%?$/i);
  if (!match) return value;
  const scale: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12, 万: 1e4, 亿: 1e8 };
  return Number(match[1]) * (scale[match[2]?.toUpperCase()] ?? 1);
}
