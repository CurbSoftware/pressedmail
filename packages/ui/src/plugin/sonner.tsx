'use client';

import * as React from 'react';

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Toaster as Sonner, type ToasterProps, toast } from 'sonner';

import { cn } from '../lib/utils';
import { useThemeClass } from './hooks/use-theme-class';

export { toast };

const Toaster = ({ className, style, ...props }: ToasterProps) => {
  const { themeClass, isDark, style: themeStyle } = useThemeClass();

  return (
    <div className={isDark ? 'dark' : undefined}>
      <Sonner
        theme={isDark ? 'dark' : 'light'}
        className={cn('toaster group', themeClass, className)}
        data-pm-portal
        icons={{
          success: <CircleCheckIcon className="size-4" />,
          info: <InfoIcon className="size-4" />,
          warning: <TriangleAlertIcon className="size-4" />,
          error: <OctagonXIcon className="size-4" />,
          loading: <Loader2Icon className="size-4 animate-spin" />,
        }}
        style={
          {
            ...themeStyle,
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
            '--border-radius': 'var(--radius)',
            ...style,
          } as React.CSSProperties
        }
        toastOptions={{
          classNames: {
            toast: 'cn-toast',
          },
          ...props.toastOptions,
        }}
        {...props}
      />
    </div>
  );
};

export { Toaster };
