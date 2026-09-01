import type { TTableCellBorder } from '@kit/plate';

export const TABLE_BORDER_DEFAULT_COLOR = '#6b7280';

export const TABLE_BORDER_SIDES = ['top', 'right', 'bottom', 'left'] as const;

export type TableBorderSide = (typeof TABLE_BORDER_SIDES)[number];
export type TableCellBorders = Partial<
  Record<TableBorderSide, TTableCellBorder>
>;

const TABLE_BORDER_STYLES = new Set(['solid', 'dashed', 'dotted', 'double']);

export function normalizeTableBorderColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const color = value.trim().toLowerCase();
  const shortHex = /^#([0-9a-f]{3})$/.exec(color);

  if (shortHex) {
    return `#${[...shortHex[1]!]
      .map((character) => `${character}${character}`)
      .join('')}`;
  }

  if (/^#[0-9a-f]{6}$/.test(color)) return color;

  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(
    color
  );

  if (!rgb) return undefined;

  const channels = rgb.slice(1).map(Number);
  if (channels.some((channel) => channel > 255)) return undefined;

  return `#${channels
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

function normalizeBorderSize(value: unknown): number {
  const size = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(size)) return 1;
  return Math.min(20, Math.max(0, size));
}

function normalizeBorderStyle(value: unknown): string {
  return typeof value === 'string' && TABLE_BORDER_STYLES.has(value)
    ? value
    : 'solid';
}

export function tableBorderToCss(
  border: TTableCellBorder | undefined,
  visibleByDefault = true
): string {
  if (!border && !visibleByDefault) return 'none';

  const size = normalizeBorderSize(border?.size);
  if (size === 0) return 'none';

  return `${size}px ${normalizeBorderStyle(border?.style)} ${
    normalizeTableBorderColor(border?.color) ?? TABLE_BORDER_DEFAULT_COLOR
  }`;
}

export function getTableCellBorderStyles(
  borders: TableCellBorders | undefined,
  visibleByDefault = true
) {
  return {
    borderBottom: tableBorderToCss(borders?.bottom, visibleByDefault),
    borderLeft: tableBorderToCss(borders?.left, visibleByDefault),
    borderRight: tableBorderToCss(borders?.right, visibleByDefault),
    borderTop: tableBorderToCss(borders?.top, visibleByDefault),
  };
}

export function getTableCellBorderStyleAttribute(
  borders: TableCellBorders | undefined,
  {
    includeLeft = true,
    includeTop = true,
  }: { includeLeft?: boolean; includeTop?: boolean } = {}
): string {
  const styles = getTableCellBorderStyles(borders);

  return [
    `border-top:${includeTop ? styles.borderTop : 'none'}`,
    `border-right:${styles.borderRight}`,
    `border-bottom:${styles.borderBottom}`,
    `border-left:${includeLeft ? styles.borderLeft : 'none'}`,
  ].join(';');
}

export function parseTableBorderCss(
  value: string | undefined
): TTableCellBorder | undefined {
  const border = value?.trim().toLowerCase();
  if (!border) return undefined;
  if (border === 'none' || /^0(?:px)?(?:\s|$)/.test(border)) {
    return { size: 0 };
  }

  const match =
    /^(\d+(?:\.\d+)?)px\s+(solid|dashed|dotted|double)\s+(.+)$/.exec(border);
  if (!match) return undefined;

  const color = normalizeTableBorderColor(match[3]);
  if (!color) return undefined;

  return {
    color,
    size: normalizeBorderSize(match[1]),
    style: match[2],
  };
}

export function parseTableCellBorders(
  element: HTMLElement
): TableCellBorders | undefined {
  const rawStyle = element.getAttribute('style') ?? '';
  const shorthand = element.style.getPropertyValue('border');
  const borders = Object.fromEntries(
    TABLE_BORDER_SIDES.flatMap((side) => {
      const rawSide = new RegExp(
        `(?:^|;)\\s*border-${side}\\s*:\\s*([^;]+)`,
        'i'
      ).exec(rawStyle)?.[1];
      const sideStyle = element.style.getPropertyValue(`border-${side}-style`);
      const sideValue =
        rawSide ||
        element.style.getPropertyValue(`border-${side}`) ||
        (sideStyle === 'none'
          ? 'none'
          : [
              element.style.getPropertyValue(`border-${side}-width`),
              sideStyle,
              element.style.getPropertyValue(`border-${side}-color`),
            ]
              .filter(Boolean)
              .join(' ')) ||
        shorthand;
      const border = parseTableBorderCss(sideValue);

      return border ? [[side, border]] : [];
    })
  ) as TableCellBorders;

  return Object.keys(borders).length > 0 ? borders : undefined;
}
