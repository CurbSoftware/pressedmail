import { Skeleton } from "@kit/ui/plugin";

export function MailListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-1.5 p-3 pt-0">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="grid h-[52px] w-full rounded-lg border"
          style={{
            gridTemplateColumns: "8px 1fr auto",
            padding: "8px 12px",
            gap: "8px",
          }}>
          {/* Unread indicator placeholder */}
          <div className="flex items-center justify-center">
            {index % 3 === 0 && <Skeleton className="h-2 w-2 rounded-full" />}
          </div>

          {/* Main content area */}
          <div
            className="flex flex-col justify-center gap-1"
            style={{ minWidth: 0, overflow: "hidden" }}>
            {/* Row 1: Sender + Subject */}
            <div
              className="flex items-center gap-2"
              style={{ minWidth: 0, overflow: "hidden" }}>
              <Skeleton className="h-3.5 w-24" style={{ flexShrink: 0 }} />
              <Skeleton className="h-3" style={{ flex: 1, minWidth: 0 }} />
            </div>
            {/* Row 2: Preview snippet */}
            <Skeleton className="h-3 w-3/4" />
          </div>

          {/* Trailing metadata column */}
          <div
            className="flex items-center justify-end gap-1.5"
            style={{ flexShrink: 0 }}>
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
