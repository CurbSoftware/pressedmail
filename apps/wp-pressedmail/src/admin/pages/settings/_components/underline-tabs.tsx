import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@kit/ui/plugin";

import { useIsMobileOrTablet } from "@/hooks/useMobile";

const UnderlineTabs = TabsPrimitive.Root;

const UnderlineTabsList: React.FC<
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
> = ({ className, ...props }) => (
  <TabsPrimitive.List
    className={cn(
      "h-auto w-full justify-start gap-1 rounded-lg border bg-muted/35 p-1 shadow-sm",
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
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "inline-flex shrink-0 snap-start items-center gap-2",
        className,
      )}
      {...props}>
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
      "mt-6 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-hidden",
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
