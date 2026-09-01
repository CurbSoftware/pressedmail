import { cn } from '#utils';

interface SectionDividerProps {
  color?: 'cyan' | 'gold' | 'purple'; // All render as primary for consistency
  index?: number;
  className?: string;
}

// All dividers use primary color for consistency
const colors = {
  primary: {
    blur: 'bg-primary/8',
    line: 'bg-primary/40',
  },
  secondary: {
    blur: 'bg-primary/12',
    line: 'bg-primary/60',
  },
};

export function SectionDivider({ className }: SectionDividerProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 z-10 h-64 overflow-visible',
        className,
      )}
    >
      {/* Primary glow - large diffuse blur (reduced intensity) */}
      <div
        className={cn(
          'absolute top-0 left-1/2 h-[160px] w-[85%] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-full blur-[60px]',
          colors.primary.blur,
        )}
      />

      {/* Secondary glow - tighter (reduced intensity) */}
      <div
        className={cn(
          'absolute top-0 left-1/2 h-[60px] w-[60%] max-w-2xl -translate-x-1/2 -translate-y-1/3 rounded-full blur-[40px]',
          colors.secondary.blur,
        )}
      />

      {/* Primary line - wider */}
      <div
        className={cn(
          'absolute top-0 left-1/2 h-[1px] w-[85%] max-w-3xl -translate-x-1/2',
          colors.primary.line,
        )}
        style={{
          maskImage:
            'linear-gradient(to right, transparent, black 20%, black 80%, transparent)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent, black 20%, black 80%, transparent)',
        }}
      />

      {/* Secondary line - tighter, brighter */}
      <div
        className={cn(
          'absolute top-0 left-1/2 h-[2px] w-[60%] max-w-xl -translate-x-1/2',
          colors.secondary.line,
        )}
        style={{
          maskImage:
            'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
        }}
      />
    </div>
  );
}
