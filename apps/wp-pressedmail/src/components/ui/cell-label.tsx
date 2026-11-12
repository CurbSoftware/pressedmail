/**
 * The name of a table cell, shown where the column heading is not: in a
 * narrow container, where each row is a card. A table that stacks below the
 * container's 4xl width (System Emails, the delivery log) puts one in each
 * cell whose meaning the position alone does not give.
 */
export function CellLabel({ children }: { children: string }) {
  return <span className="text-xs font-medium text-muted-foreground @4xl:hidden">{children}</span>;
}
