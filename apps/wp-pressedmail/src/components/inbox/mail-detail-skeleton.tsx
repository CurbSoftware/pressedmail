import { Skeleton } from "@kit/ui/plugin";
import { __ } from "@wordpress/i18n";

/**
 * Skeleton loading state that mimics the MailDisplay layout.
 * Shown while email body is being fetched from IMAP.
 */
export function MailDetailSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-4 py-4">
      <span className="text-xs font-medium text-muted-foreground">
        {__("Loading message", "pressedmail")}
      </span>
      {/* Paragraph lines */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-full bg-muted-foreground/20" />
        <Skeleton className="h-3 w-[90%] bg-muted-foreground/20" />
        <Skeleton className="h-3 w-[95%] bg-muted-foreground/20" />
        <Skeleton className="h-3 w-[70%] bg-muted-foreground/20" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full bg-muted-foreground/20" />
        <Skeleton className="h-3 w-[85%] bg-muted-foreground/20" />
        <Skeleton className="h-3 w-[60%] bg-muted-foreground/20" />
      </div>
    </div>
  );
}
