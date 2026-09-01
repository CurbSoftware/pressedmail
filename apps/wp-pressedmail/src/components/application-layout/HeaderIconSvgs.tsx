import { forwardRef, type SVGProps } from "react";

type HeaderIconProps = SVGProps<SVGSVGElement>;
type InboxHeaderIconProps = HeaderIconProps & {
  hasUnread?: boolean;
};

export const INBOX_NO_MAIL_PATH =
  "M19 15h-4a3 3 0 0 1-3 3a3 3 0 0 1-3-3H5V5h14m0-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2";

export const INBOX_NEW_MAIL_PATH =
  "M19 15V5H5v10h4c0 1.66 1.34 3 3 3s3-1.34 3-3zm0-12c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM7 13v-2h10v2zm0-4V7h10v2z";

export const CONTACTS_HEADER_ICON_PATH =
  "M4 2a1 1 0 0 0-1 1v2h2v2H2v2h3v2H2v2h3v2H2v2h3v2H3v2a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zm5 14a3 3 0 1 1 6 0zm3-4a2 2 0 1 1 0-4a2 2 0 0 1 0 4";

export const InboxHeaderIcon = forwardRef<SVGSVGElement, InboxHeaderIconProps>(
  function InboxHeaderIcon({ hasUnread = false, ...props }, ref) {
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
          d={hasUnread ? INBOX_NEW_MAIL_PATH : INBOX_NO_MAIL_PATH}
        />
      </svg>
    );
  },
);

export const ThemePaletteIcon = forwardRef<SVGSVGElement, HeaderIconProps>(
  function ThemePaletteIcon(props, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 20 20"
        {...props}>
        <path
          fill="currentColor"
          d="M14.48 11.06L7.41 3.99l1.5-1.5c.5-.56 2.3-.47 3.51.32c1.21.8 1.43 1.28 2.91 2.1c1.18.64 2.45 1.26 4.45.85zm-.71.71L6.7 4.7L4.93 6.47a.996.996 0 0 0 0 1.41l1.06 1.06c.39.39.39 1.03 0 1.42c-.6.6-1.43 1.11-2.21 1.69c-.35.26-.7.53-1.01.84C1.43 14.23.4 16.08 1.4 17.07c.99 1 2.84-.03 4.18-1.36c.31-.31.58-.66.85-1.02c.57-.78 1.08-1.61 1.69-2.21a.996.996 0 0 1 1.41 0l1.06 1.06c.39.39 1.02.39 1.41 0z"
        />
      </svg>
    );
  },
);

export const SettingsLinkIcon = forwardRef<SVGSVGElement, HeaderIconProps>(
  function SettingsLinkIcon(props, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 20 20"
        {...props}>
        <path
          fill="currentColor"
          d="M18 16V4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h13c.55 0 1-.45 1-1M8 11h1c.55 0 1 .45 1 1s-.45 1-1 1H8v1.5c0 .28-.22.5-.5.5s-.5-.22-.5-.5V13H6c-.55 0-1-.45-1-1s.45-1 1-1h1V5.5c0-.28.22-.5.5-.5s.5.22.5.5zm5-2h-1c-.55 0-1-.45-1-1s.45-1 1-1h1V5.5c0-.28.22-.5.5-.5s.5.22.5.5V7h1c.55 0 1 .45 1 1s-.45 1-1 1h-1v5.5c0 .28-.22.5-.5.5s-.5-.22-.5-.5z"
        />
      </svg>
    );
  },
);

export const ActivityHeaderIcon = forwardRef<SVGSVGElement, HeaderIconProps>(
  function ActivityHeaderIcon(props, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 16 16"
        {...props}>
        <path
          fill="currentColor"
          d="M1 3h14v3H1zm0 4h14v3H1zm0 4h14v3H1z"
        />
      </svg>
    );
  },
);

export const CalendarHeaderIcon = forwardRef<SVGSVGElement, HeaderIconProps>(
  function CalendarHeaderIcon(props, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 20 20"
        {...props}>
        <path
          fill="currentColor"
          d="M15 4h3v14H2V4h3V3c0-.83.67-1.5 1.5-1.5S8 2.17 8 3v1h4V3c0-.83.67-1.5 1.5-1.5S15 2.17 15 3zM6 3v2.5c0 .28.22.5.5.5s.5-.22.5-.5V3c0-.28-.22-.5-.5-.5S6 2.72 6 3m7 0v2.5c0 .28.22.5.5.5s.5-.22.5-.5V3c0-.28-.22-.5-.5-.5s-.5.22-.5.5m4 14V8H3v9zM7 16V9H5v7zm4 0V9H9v7zm4 0V9h-2v7z"
        />
      </svg>
    );
  },
);

export const ContactsHeaderIcon = forwardRef<SVGSVGElement, HeaderIconProps>(
  function ContactsHeaderIcon(props, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        {...props}>
        <path fill="currentColor" d={CONTACTS_HEADER_ICON_PATH} />
      </svg>
    );
  },
);
