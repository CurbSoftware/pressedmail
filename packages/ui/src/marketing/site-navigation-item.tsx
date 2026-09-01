'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn, isRouteActive } from '#utils';

import { NavigationMenuItem } from '../shadcn/navigation-menu';

const getClassName = (
  path: string,
  currentPathName: string,
  highlighted?: boolean,
) => {
  const isActive = isRouteActive(path, currentPathName);

  return cn(
    // Match NavigationMenuTrigger styling
    'group inline-flex h-9 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-colors',
    'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none',
    'disabled:pointer-events-none disabled:opacity-50',
    {
      'text-muted-foreground hover:text-foreground': !isActive,
      'text-foreground': isActive,
      'hover:border-primary border border-transparent': highlighted,
    },
  );
};

export function SiteNavigationItem({
  path,
  children,
  highlighted,
}: React.PropsWithChildren<{
  path: string;
  highlighted?: boolean;
}>) {
  const currentPathName = usePathname();
  const className = getClassName(path, currentPathName, highlighted);

  return (
    <NavigationMenuItem key={path}>
      <Link className={className} href={path} as={path} prefetch={true}>
        {children}
      </Link>
    </NavigationMenuItem>
  );
}
