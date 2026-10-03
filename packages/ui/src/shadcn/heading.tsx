import { cn } from '../lib/utils';

type Level = 1 | 2 | 3 | 4 | 5 | 6;

const LEVEL_STYLES: Record<Level, string> = {
  1: `font-heading scroll-m-20 text-3xl font-bold tracking-tight lg:text-4xl dark:text-foreground`,
  2: `font-heading scroll-m-20 pb-2 text-2xl font-semibold tracking-tight transition-colors first:mt-0 lg:text-3xl`,
  3: 'font-heading scroll-m-20 text-xl font-semibold tracking-tight lg:text-2xl',
  4: 'font-heading scroll-m-20 text-lg font-semibold tracking-tight lg:text-xl',
  5: 'font-heading scroll-m-20 text-base font-medium lg:text-lg',
  6: 'font-heading scroll-m-20 text-base font-medium',
};

/**
 * `level` sets the look; `as` sets the element when the outline needs a
 * different level than the look, e.g. a page title that is an h1 but sized
 * like an h3.
 */
export function Heading({
  level = 1,
  as,
  id,
  children,
  className,
}: React.PropsWithChildren<{
  level?: Level;
  as?: `h${Level}`;
  id?: string;
  className?: string;
}>) {
  const Tag = as ?? (`h${level}` as const);

  return (
    <Tag id={id} className={cn(LEVEL_STYLES[level], className)}>
      {children}
    </Tag>
  );
}
