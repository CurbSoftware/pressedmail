import { forwardRef, type SVGProps } from "react";
import { CalendarClock } from "lucide-react";

type FolderIconProps = SVGProps<SVGSVGElement>;

/**
 * Snooze (alarm-clock-with-Z) icon used for the local Snoozed workflow view
 * across every inbox layout variant. Typed as a plain SVG component so it is
 * assignable wherever the layouts expect a Lucide icon.
 */
export const SnoozeClockIcon = forwardRef<SVGSVGElement, FolderIconProps>(
  function SnoozeClockIcon(props, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        {...props}>
        <path
          fill="currentColor"
          d="M9 11h3.63L9 15.2V17h6v-2h-3.63L15 10.8V9H9zm7.056-7.654l1.282-1.535l4.607 3.85l-1.28 1.54zM3.336 7.19l-1.28-1.536L6.662 1.81l1.28 1.536zM12 6c3.86 0 7 3.14 7 7s-3.14 7-7 7s-7-3.14-7-7s3.14-7 7-7m0-2a9 9 0 1 0 .001 18.001A9 9 0 0 0 12 4"
        />
      </svg>
    );
  },
);

/**
 * Scheduled folder icon. This matches the icon used in the Scheduled Emails
 * list header so the virtual folder and its messages use one visual cue.
 */
export const ScheduledFolderIcon = forwardRef<SVGSVGElement, FolderIconProps>(
  function ScheduledFolderIcon(props, ref) {
    return <CalendarClock ref={ref} {...props} />;
  },
);
