'use client';

import * as React from 'react';

import { cn } from '#lib/utils';

const ScrollRegionsContext = React.createContext(false);

/**
 * Opt-in for an app: inside it, a Table wider than its box becomes a named,
 * focusable region, since keyboard users can only scroll what they can focus.
 * Outside it, Table renders exactly as before.
 */
function TableScrollRegions({ children }: React.PropsWithChildren) {
  return <ScrollRegionsContext value={true}>{children}</ScrollRegionsContext>;
}

function Table(props: React.ComponentProps<'table'>) {
  return React.useContext(ScrollRegionsContext) ? (
    <ScrollRegionTable {...props} />
  ) : (
    <PlainTable {...props} />
  );
}

function PlainTable({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  );
}

function ScrollRegionTable({
  className,
  'aria-label': ariaLabel,
  ...props
}: React.ComponentProps<'table'>) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const regionLabel = useScrollRegionLabel(containerRef, ariaLabel);

  return (
    // The name goes on the region or the table, never both.
    <div
      ref={containerRef}
      data-slot="table-container"
      className="focus-visible:ring-ring/50 relative w-full overflow-x-auto outline-none focus-visible:ring-[3px]"
      {...(regionLabel
        ? { tabIndex: 0, role: 'region', 'aria-label': regionLabel }
        : {})}
    >
      <table
        data-slot="table"
        aria-label={regionLabel ? undefined : ariaLabel}
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  );
}

/**
 * The region's name while the table scrolls sideways, else null. Without an
 * aria-label it borrows the nearest heading (the card or section title), so
 * two scrolling tables on one page don't both announce the same name.
 */
function useScrollRegionLabel(
  ref: React.RefObject<HTMLDivElement | null>,
  ariaLabel: string | undefined,
) {
  const [label, setLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const check = () =>
      setLabel(
        element.scrollWidth > element.clientWidth + 1
          ? (ariaLabel ?? nearestHeading(element) ?? 'Table')
          : null,
      );
    const observer = new ResizeObserver(check);

    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    check();

    return () => observer.disconnect();
  }, [ref, ariaLabel]);

  return label;
}

const HEADING = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

function nearestHeading(element: HTMLElement) {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const heading = node.querySelector(HEADING);
    const text = heading?.textContent?.trim();
    if (text) return text;
  }

  return null;
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('[&_tr]:border-b', className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        'bg-muted/50 border-t font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('text-muted-foreground mt-4 text-sm', className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableScrollRegions,
};
