'use client';

import React from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn, isRouteActive } from '#utils';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const transition = {
  type: 'spring' as const,
  mass: 0.5,
  damping: 11.5,
  stiffness: 100,
  restDelta: 0.001,
  restSpeed: 0.001,
};

export function NavMenu({
  setActive,
  children,
}: {
  active: string | null;
  setActive: (item: string | null) => void;
  children: React.ReactNode;
}) {
  return (
    <nav
      onMouseLeave={() => setActive(null)}
      className="flex items-center gap-0.5"
    >
      {children}
    </nav>
  );
}

export function NavLink({
  href,
  children,
  analyticsLabel,
  analyticsLocation = 'desktop',
}: {
  href: string;
  children: React.ReactNode;
  analyticsLabel?: string;
  analyticsLocation?: string;
}) {
  const pathname = usePathname();
  const isActive = isRouteActive(href, pathname);

  return (
    <Link
      href={href}
      prefetch={true}
      data-umami-event="nav_link_clicked"
      data-umami-event-nav-label={analyticsLabel ?? href}
      data-umami-event-nav-location={analyticsLocation}
      data-umami-event-nav-target={href}
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isActive ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      {children}
    </Link>
  );
}

export function NavMenuItem({
  item,
  active,
  setActive,
  children,
  align = 'center',
  href,
}: {
  item: string;
  active: string | null;
  setActive: (item: string) => void;
  children: React.ReactNode;
  align?: 'center' | 'left' | 'right' | 'nav-center' | 'viewport-center';
  href?: string;
}) {
  const triggerClassName = cn(
    'inline-flex h-9 items-center justify-center gap-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
    'hover:bg-accent hover:text-accent-foreground',
    active === item ? 'text-foreground' : 'text-muted-foreground',
  );

  const chevron = (
    <ChevronDown
      className={cn(
        'h-3.5 w-3.5 transition-transform duration-200',
        active === item && 'rotate-180',
      )}
    />
  );

  return (
    <div
      onMouseEnter={() => setActive(item)}
      className={cn(
        "relative after:absolute after:top-full after:left-0 after:h-5 after:w-full after:content-['']",
        align === 'nav-center' && 'static',
      )}
    >
      {href ? (
        <Link href={href} prefetch={true} className={triggerClassName}>
          {item}
          {chevron}
        </Link>
      ) : (
        <button
          type="button"
          className={triggerClassName}
          data-umami-event="nav_menu_opened"
          data-umami-event-nav-label={item}
          data-umami-event-nav-location="desktop"
        >
          {item}
          {chevron}
        </button>
      )}

      <AnimatePresence>
        {active === item && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: transition,
            }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: 8,
              transition: { duration: 0.15, ease: 'easeOut' },
            }}
            className={cn(
              'pointer-events-none z-50',
              align === 'viewport-center'
                ? 'fixed top-16 left-1/2 -translate-x-1/2'
                : [
                    'absolute top-[calc(100%+0.5rem)]',
                    align === 'left'
                      ? 'left-0'
                      : align === 'right'
                        ? 'right-0'
                        : 'left-1/2 -translate-x-1/2',
                  ],
            )}
          >
            <motion.div
              className="bg-card text-card-foreground border-border ring-border/60 pointer-events-auto isolate overflow-hidden rounded-xl border shadow-2xl ring-1"
              transition={transition}
            >
              <motion.div layout className="p-4" transition={transition}>
                {children}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CategoryItem({
  href,
  icon: Icon,
  title,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <Link
      href={href}
      className="hover:bg-accent flex items-center gap-2.5 rounded-lg p-3 transition-colors"
    >
      <Icon className="text-muted-foreground h-4.5 w-4.5 shrink-0" />
      <span className="text-foreground text-sm font-medium">{title}</span>
    </Link>
  );
}

export function ResourceItem({
  href,
  icon: Icon,
  title,
  description,
  external,
  analyticsLocation = 'desktop',
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  external?: boolean;
  analyticsLocation?: string;
}) {
  const className =
    'hover:bg-accent flex h-full items-start gap-3 rounded-lg p-2.5 transition-colors';

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-umami-event="nav_link_clicked"
        data-umami-event-nav-label={title}
        data-umami-event-nav-location={analyticsLocation}
        data-umami-event-nav-target={href}
        className={className}
      >
        <Icon className="text-muted-foreground mt-0.5 h-4.5 w-4.5 shrink-0" />
        <div>
          <p className="text-foreground text-sm font-medium">{title}</p>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={className}
      data-umami-event="nav_link_clicked"
      data-umami-event-nav-label={title}
      data-umami-event-nav-location={analyticsLocation}
      data-umami-event-nav-target={href}
    >
      <Icon className="text-muted-foreground mt-0.5 h-4.5 w-4.5 shrink-0" />
      <div>
        <p className="text-foreground text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </Link>
  );
}
