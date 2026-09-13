import * as React from "react";

/**
 * Keyboard model for the message list.
 *
 * The list is an ARIA grid: one tab stop for the whole list, arrow keys to move
 * between rows, Home and End to jump to either end, and Enter or Space on a row
 * to open it (handled by the row itself). Every list variant shares this, so a
 * keyboard user gets the same behaviour whichever layout they run.
 *
 * Rows are found in the DOM rather than through refs because they are rendered
 * by three different list components and wrapped in drag handles, and the row
 * elements already carry `data-message-row` for exactly this.
 */
const ROW_SELECTOR = '[data-message-row="true"]';

export interface MessageGridNavigation<T extends HTMLElement> {
  /** Spread onto the element that carries role="grid". */
  gridProps: {
    ref: React.RefObject<T | null>;
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
    onFocus: (event: React.FocusEvent<HTMLElement>) => void;
  };
  /** Roving tabindex: 0 for the row holding the tab stop, -1 for the rest. */
  getRowTabIndex: (index: number) => number;
}

export function useMessageGridNavigation<T extends HTMLElement>(
  rowCount: number,
): MessageGridNavigation<T> {
  const gridRef = React.useRef<T | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);

  // Rows come and go (paging, sweeps, a folder change). Keep the tab stop on a
  // row that still exists, otherwise the list loses its only entry point.
  React.useEffect(() => {
    setActiveIndex((current) =>
      rowCount <= 0 ? 0 : Math.min(current, rowCount - 1),
    );
  }, [rowCount]);

  const rowsFromDom = React.useCallback((): HTMLElement[] => {
    const rows = gridRef.current?.querySelectorAll<HTMLElement>(ROW_SELECTOR);
    return rows ? Array.from(rows) : [];
  }, []);

  const indexOfEventRow = React.useCallback(
    (rows: HTMLElement[], target: EventTarget | null): number => {
      if (!(target instanceof Node)) return -1;
      return rows.findIndex((row) => row === target || row.contains(target));
    },
    [],
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const rows = rowsFromDom();
      if (rows.length === 0) return;

      const current = indexOfEventRow(rows, event.target);
      if (current < 0) return;

      let next: number;
      switch (event.key) {
        case "ArrowDown":
          next = Math.min(current + 1, rows.length - 1);
          break;
        case "ArrowUp":
          next = Math.max(current - 1, 0);
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = rows.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      setActiveIndex(next);
      rows[next]?.focus();
    },
    [indexOfEventRow, rowsFromDom],
  );

  // Clicking or tabbing into a row makes it the tab stop, so leaving and
  // returning to the list comes back to where the user was.
  const onFocus = React.useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      const index = indexOfEventRow(rowsFromDom(), event.target);
      if (index >= 0) setActiveIndex(index);
    },
    [indexOfEventRow, rowsFromDom],
  );

  return {
    gridProps: { ref: gridRef, onKeyDown, onFocus },
    getRowTabIndex: (index: number) => (index === activeIndex ? 0 : -1),
  };
}
