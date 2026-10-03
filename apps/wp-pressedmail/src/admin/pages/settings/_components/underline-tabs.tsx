import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@kit/ui/plugin";

import { useIsMobileOrTablet } from "@/hooks/useMobile";

const UnderlineTabs = TabsPrimitive.Root;

/**
 * `boxed` is the pill strip a card's own tabs use. `line` is a rule with the
 * chosen tab underlined: the look a page's top-level tabs have, which is how AI
 * Tools draws its two, so a page that chooses what is on it reads the same
 * wherever it is. The page's tabs choose what is on the page and a card's tabs
 * choose what is in the card, which is why they are drawn differently.
 */
type UnderlineTabsVariant = "boxed" | "line";

const UnderlineTabsList: React.FC<
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
    variant?: UnderlineTabsVariant;
  }
> = ({ className, variant = "boxed", ...props }) => (
  <TabsPrimitive.List
    data-variant={variant}
    className={cn(
      "group/underline-list h-auto w-full justify-start gap-1",
      variant === "line"
        ? "rounded-none border-0 border-b bg-transparent p-0 shadow-none"
        : "rounded-lg border bg-muted/35 p-1 shadow-sm",
      // Horizontally scrollable on narrow containers instead of wrapping/clipping
      // the tab row. Hidden scrollbar + momentum scroll keeps it native-feeling.
      "flex flex-nowrap items-center overflow-x-auto snap-x",
      "pm-momentum-scroll pm-no-tap-highlight",
      "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      className,
    )}
    {...props}
  />
);
UnderlineTabsList.displayName = "UnderlineTabsList";

interface UnderlineTabsTriggerProps extends React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.Trigger
> {
  /**
   * Compact label rendered in place of `children` on mobile/tablet containers,
   * so the scrollable tab row stays short. Falls back to `children` when absent.
   */
  shortLabel?: React.ReactNode;
}

const UnderlineTabsTrigger: React.FC<UnderlineTabsTriggerProps> = ({
  className,
  children,
  shortLabel,
  onClick,
  ...props
}) => {
  const isMobile = useIsMobileOrTablet();
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative rounded-md bg-transparent px-3.5 py-2",
        "text-sm font-medium text-muted-foreground",
        "hover:text-foreground transition-colors",
        "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        // In dark the background sits below the muted track, so the chosen tab
        // barely stood out: lift it a step and give it an edge.
        "dark:data-[state=active]:bg-accent dark:data-[state=active]:ring-1 dark:data-[state=active]:ring-border",
        // The line variant: square, flush, and the chosen tab underlined instead
        // of raised. Each override is stacked with the state it replaces, so it
        // out-ranks the boxed look whatever order the stylesheet loads in.
        "group-data-[variant=line]/underline-list:rounded-none group-data-[variant=line]/underline-list:px-4",
        "group-data-[variant=line]/underline-list:data-[state=active]:bg-transparent group-data-[variant=line]/underline-list:data-[state=active]:shadow-none",
        "dark:group-data-[variant=line]/underline-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/underline-list:data-[state=active]:ring-0",
        "group-data-[variant=line]/underline-list:after:absolute group-data-[variant=line]/underline-list:after:inset-x-0 group-data-[variant=line]/underline-list:after:bottom-0 group-data-[variant=line]/underline-list:after:h-0.5 group-data-[variant=line]/underline-list:after:bg-foreground group-data-[variant=line]/underline-list:after:opacity-0 group-data-[variant=line]/underline-list:after:transition-opacity group-data-[variant=line]/underline-list:data-[state=active]:after:opacity-100",
        "inline-flex shrink-0 snap-start items-center gap-2",
        // A finger needs 44px, which the padded label alone comes 8px short of.
        isMobile && "min-h-11",
        className,
      )}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        // A tab picked at the clipped edge of a narrow row slides fully into view.
        event.currentTarget.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      }}>
      {isMobile && shortLabel != null ? shortLabel : children}
    </TabsPrimitive.Trigger>
  );
};
UnderlineTabsTrigger.displayName = "UnderlineTabsTrigger";

const UnderlineTabsContent: React.FC<
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
> = ({ className, ...props }) => (
  <TabsPrimitive.Content
    className={cn(
      "mt-6",
      className,
    )}
    {...props}
  />
);
UnderlineTabsContent.displayName = "UnderlineTabsContent";

export {
  UnderlineTabs,
  UnderlineTabsList,
  UnderlineTabsTrigger,
  UnderlineTabsContent,
};
