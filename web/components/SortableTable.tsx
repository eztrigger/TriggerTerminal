"use client";

import {tr,uiLocale} from "../lib/i18n";
import { Children, Fragment, cloneElement, isValidElement, useState, type ReactNode, type ReactElement, type HTMLAttributes, type TableHTMLAttributes } from "react";
import { nextSort, sortRows, type SortValue, type TableSort } from "../lib/table-sort";

type RowProps = HTMLAttributes<HTMLTableRowElement> & { values: readonly SortValue[] };
export function SortRow({ values: _values, ...props }: RowProps) {
  return <tr {...props} />;
}

type NodeProps = { children?: ReactNode; colSpan?: number; "data-sort-disabled"?: boolean };
function element(node: ReactNode): node is ReactElement<NodeProps> { return isValidElement(node); }
function rowValues(node: ReactNode): readonly SortValue[] | undefined {
  if (!element(node)) return undefined;
  if (node.type === SortRow) return (node.props as RowProps).values;
  // A fragment is a row group: keep its expanded details attached when sorting.
  if (node.type === Fragment) return Children.toArray(node.props.children).map(rowValues).find(Boolean);
  return undefined;
}
function labelText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  return element(node) ? labelText(node.props.children) : Array.isArray(node) ? node.map(labelText).join("") : "";
}

type Props = TableHTMLAttributes<HTMLTableElement> & { sort?: TableSort; onSortChange?: (sort: TableSort) => void };
export default function SortableTable({ children, sort: controlledSort, onSortChange, ...props }: Props) {
  const [localSort, setLocalSort] = useState<TableSort>(null);
  const sort = controlledSort === undefined ? localSort : controlledSort;
  const setSort = (value: TableSort) => { setLocalSort(value); onSortChange?.(value); };
  function header(node: ReactNode): ReactNode {
    if (!element(node)) return node;
    if (node.type === "tr") {
      let column = 0;
      return cloneElement(node, {}, Children.map(node.props.children, cell => {
        if (!element(cell)) return cell;
        const index = column;
        column += cell.props.colSpan ?? 1;
        const label = labelText(cell.props.children).trim();
        if (cell.type !== "th" || (cell.props.colSpan ?? 1) > 1 || !label || cell.props["data-sort-disabled"]) return cell;
        const active = sort?.column === index;
        const direction = active ? sort.direction : null;
        const next = direction === "asc" ? "降序" : direction === "desc" ? "默认顺序" : "升序";
        return cloneElement(cell as ReactElement<HTMLAttributes<HTMLTableCellElement>>, {
          "aria-sort": direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none",
        }, <button type="button" className="table-sort-button" title={tr(`${label}：${next}`)} aria-label={tr(`${label}：${next}`)}
          onClick={() => setSort(nextSort(sort, index))}>
          {tr(cell.props.children)}<span className="table-sort-indicator" aria-hidden="true">{tr(direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕")}</span>
        </button>);
      }));
    }
    return cloneElement(node, {}, Children.map(node.props.children, header));
  }
  return <table {...props}><caption className="table-sort-caption"><button type="button" onClick={() => setSort(null)} disabled={!sort} title={tr("恢复默认顺序")} aria-label={tr("恢复默认顺序")}>↶</button><span>{tr(sort ? (sort.direction === "asc" ? "升序" : "降序") : "默认顺序")}</span></caption>{tr(Children.map(children, section => {
    if (!element(section)) return section;
    if (section.type === "thead") return header(section);
    if (section.type !== "tbody") return section;
    const rows = Children.toArray(section.props.children);
    const sorted = sortRows(rows.filter(row => rowValues(row) !== undefined), sort, (row, column) => rowValues(row)?.[column]);
    let index = 0;
    // Summary/empty rows without values retain their original positions.
    return cloneElement(section, {}, rows.map(row => rowValues(row) === undefined ? row : sorted[index++]));
  }))}</table>;
}
