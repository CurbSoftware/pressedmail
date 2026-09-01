'use client';

import { useRender } from '@base-ui/react/use-render';

import { cn } from '../../lib/utils';
import { GradientSecondaryText } from './gradient-secondary-text';

export const Pill: React.FC<
  React.HTMLAttributes<HTMLHeadingElement> & {
    label?: React.ReactNode;
    render?: React.ReactElement;
  }
> = function PillComponent({ className, render, label, children, ...props }) {
  const content = (
    <>
      {label && (
        <span
          className={
            'text-primary-foreground bg-primary rounded-2xl border px-1.5 py-0.5 text-xs font-bold tracking-tight'
          }
        >
          {label}
        </span>
      )}
      <GradientSecondaryText
        className={'flex items-center gap-x-2 font-semibold tracking-tight'}
      >
        {children}
      </GradientSecondaryText>
    </>
  );

  return useRender({
    render,
    defaultTagName: 'h3',
    props: {
      ...props,
      className: cn(
        'bg-muted/50 flex min-h-10 items-center gap-x-1.5 rounded-full border px-2 py-1 text-center text-sm font-medium text-transparent',
        className,
      ),
      children: content,
    },
  });
};

export const PillActionButton: React.FC<
  React.HTMLAttributes<HTMLButtonElement> & {
    render?: React.ReactElement;
  }
> = ({ render, children, className, ...props }) => {
  return useRender({
    render,
    defaultTagName: 'button',
    props: {
      ...props,
      className: cn(
        'text-secondary-foreground bg-input active:bg-primary active:text-primary-foreground hover:ring-muted-foreground/50 rounded-full px-1.5 py-1.5 text-center text-sm font-medium ring ring-transparent transition-colors',
        className,
      ),
      children,
      'aria-label': 'Action button',
    },
  });
};
