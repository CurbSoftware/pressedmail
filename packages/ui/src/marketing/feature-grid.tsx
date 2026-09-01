import React from 'react';

import { cn } from '../lib/utils';

export const FeatureGrid: React.FC<React.HTMLAttributes<HTMLDivElement>> =
  function FeatureGridComponent({ className, children, ...props }) {
    return (
      <div
        className={cn(
          'mt-4 grid w-full grid-cols-1 gap-6 md:mt-8 md:grid-cols-2 md:gap-8 lg:grid-cols-3 lg:gap-10',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  };
