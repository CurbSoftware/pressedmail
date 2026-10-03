/**
 * Free build stand-in for itip-banner.tsx. Calendar invites are Pro, and the
 * reading pane compiles its banner behind `__ENABLE_CALENDAR__`, so Free ships
 * no invite banner and no calendar copy.
 */
import type { ITipEvent } from "@/types/itip";

export function ITipBanner(_props: {
  event: ITipEvent;
  onAddToCalendar?: () => void;
}): null {
  return null;
}

export default ITipBanner;
