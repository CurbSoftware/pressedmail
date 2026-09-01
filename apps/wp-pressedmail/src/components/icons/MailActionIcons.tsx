import { forwardRef, type SVGProps } from "react";

type MailActionIconProps = SVGProps<SVGSVGElement> & {
  size?: string | number;
  absoluteStrokeWidth?: boolean;
};
type AiSummaryIconProps = MailActionIconProps & {
  filled?: boolean;
};

const AI_SUMMARY_FILLED_PATH =
  "M18 3a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm-5.412 4.4a.632.632 0 0 0-1.176 0l-.317.763a5.46 5.46 0 0 1-2.814 2.908l-.896.399c-.513.228-.513.975 0 1.204l.95.422a5.45 5.45 0 0 1 2.773 2.813l.308.707a.633.633 0 0 0 1.168 0l.308-.707a5.45 5.45 0 0 1 2.773-2.813l.95-.422c.514-.229.513-.976 0-1.204l-.896-.399a5.46 5.46 0 0 1-2.815-2.908z";
const AI_SUMMARY_OUTLINE_PATH =
  "M18 3a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM6 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm5.412 2.4a.632.632 0 0 1 1.176 0l.316.763a5.46 5.46 0 0 0 2.815 2.908l.896.399c.513.228.514.975 0 1.204l-.95.422a5.45 5.45 0 0 0-2.773 2.813l-.308.707a.633.633 0 0 1-1.168 0l-.308-.707a5.45 5.45 0 0 0-2.773-2.813l-.95-.422c-.513-.229-.513-.976 0-1.204l.896-.399a5.46 5.46 0 0 0 2.814-2.908z";
const EMAIL_MARK_UNREAD_PATH =
  "M2 20V4h12.1q-.1.5-.1 1t.1 1H4l8 5l3.65-2.275q.35.325.763.563t.862.412L12 13L4 8v10h16V9.9q.575-.125 1.075-.35T22 9v11zM4 6v12zm12.875 1.125Q16 6.25 16 5t.875-2.125T19 2t2.125.875T22 5t-.875 2.125T19 8t-2.125-.875";
const EMAIL_MARK_READ_PATH =
  "M12 19a6.995 6.995 0 0 1 10-6.32V4H2v16h10.08c-.05-.33-.08-.66-.08-1M4 6l8 5l8-5v2l-8 5l-8-5zm13.34 16l-3.54-3.54l1.41-1.41l2.12 2.12l4.24-4.24L23 16.34z";
const CONTACTS_PAGE_PATH =
  "M4 2a1 1 0 0 0-1 1v2h2v2H2v2h3v2H2v2h3v2H2v2h3v2H3v2a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zm5 14a3 3 0 1 1 6 0zm3-4a2 2 0 1 1 0-4a2 2 0 0 1 0 4";
const EMAIL_JUNK_PATH =
  "m15.936 2.501l5.565 5.565v7.87l-5.565 5.565h-7.87l-5.565-5.565v-7.87l5.565-5.565zm-.828 2H8.894L4.501 8.894v6.214L8.894 19.5h6.214l4.393-4.393V8.894zM8 11.001h8v2H8z";
const EMAIL_AUTO_TAG_PATH = "M3 14h7v7H3zm11 0h7v7h-7zM3 3h7v7H3z";
const EMAIL_AUTO_TAG_SPARKLE_PATH =
  "m18 3.75l.7 1.55l1.55.7l-1.55.7l-.7 1.55l-.7-1.55l-1.55-.7l1.55-.7z";
const EMAIL_SUMMARY_PATH = "M8 8h4.5M8 12h8m-8 4h5m7.5-4v9.5h-17v-19h9";
const EMAIL_SUMMARY_SPARKLE_PATH =
  "m19 2.75l.7 1.55l1.55.7l-1.55.7l-.7 1.55l-.7-1.55l-1.55-.7l1.55-.7z";
const EMAIL_SWEEP_PATH =
  "M1093.636 0L683.919 409.716c-29.44-16.92-67.651-12.834-92.811 12.325c-21.045 21.044-27.335 51.226-18.931 77.763c-57.811-29.551-124.29-34.53-191.204-5.992C255.457 556.096 168.858 685.687 0 700.744c12.889 26.536 29.579 56.126 50.049 88.726c71.005 11.18 140.925-11.4 195.559-67.14c-21.221 66.046-73.074 115.338-143.2 141.02c18.195 24.261 39.007 49.729 62.509 76.265c80.851-27.028 109.762-64.018 34.115 36.294c31.904 33.138 66.075 68.279 108.064 97.849c18.654-68.878 68.927-121.768 140.953-148.987c-55.188 51.727-77.289 126.649-63.667 206.934c41.698 28.051 79.998 50.86 114.873 68.297c29.705-127.434 116.39-259.614 206.935-380.972c29.215-61.498 24.481-127.952-6.605-191.407c26.685 8.697 57.168 2.481 78.375-18.726c25.159-25.159 29.244-63.37 12.324-92.811L1200 106.37L1093.639.008z";

export const EmailMoreActionsIcon = forwardRef<
  SVGSVGElement,
  MailActionIconProps
>(function EmailMoreActionsIcon(props, ref) {
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
        d="M17 13h-4v4h-2v-4H7v-2h4V7h2v4h4m2-8H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2"
      />
    </svg>
  );
});

export const EmailMarkUnreadIcon = forwardRef<
  SVGSVGElement,
  MailActionIconProps
>(function EmailMarkUnreadIcon(props, ref) {
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}>
      <path fill="currentColor" d={EMAIL_MARK_UNREAD_PATH} />
    </svg>
  );
});

export const EmailMarkReadIcon = forwardRef<SVGSVGElement, MailActionIconProps>(
  function EmailMarkReadIcon(props, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        {...props}>
        <path fill="currentColor" d={EMAIL_MARK_READ_PATH} />
      </svg>
    );
  },
);

export const EmailArchiveIcon = forwardRef<SVGSVGElement, MailActionIconProps>(
  function EmailArchiveIcon(props, ref) {
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
          d="M20 21H4V10h2v9h12v-9h2zM3 3h18v6H3zm6.5 8h5c.28 0 .5.22.5.5V13H9v-1.5c0-.28.22-.5.5-.5M5 5v2h14V5z"
        />
      </svg>
    );
  },
);

export const EmailTrashIcon = forwardRef<SVGSVGElement, MailActionIconProps>(
  function EmailTrashIcon(props, ref) {
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
          d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM8 9h8v10H8zm7.5-5l-1-1h-5l-1 1H5v2h14V4z"
        />
      </svg>
    );
  },
);

export const EmailComposeNewIcon = forwardRef<
  SVGSVGElement,
  MailActionIconProps
>(function EmailComposeNewIcon(props, ref) {
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="-0.5 -0.5 24 24"
      {...props}>
      <path
        fill="currentColor"
        d="m21.289.98l.59.59c.813.814.69 2.257-.277 3.223L9.435 16.96l-3.942 1.442c-.495.182-.977-.054-1.075-.525a.93.93 0 0 1 .045-.51l1.47-3.976L18.066 1.257c.967-.966 2.41-1.09 3.223-.276zM8.904 2.19a1 1 0 1 1 0 2h-4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4a1 1 0 0 1 2 0v4a4 4 0 0 1-4 4h-12a4 4 0 0 1-4-4v-12a4 4 0 0 1 4-4z"
      />
    </svg>
  );
});

export const EmailRefreshIcon = forwardRef<SVGSVGElement, MailActionIconProps>(
  function EmailRefreshIcon(props, ref) {
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
          d="M17.65 6.35A7.96 7.96 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z"
        />
      </svg>
    );
  },
);

export const ContactsPageIcon = forwardRef<SVGSVGElement, MailActionIconProps>(
  function ContactsPageIcon(props, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        {...props}>
        <path fill="currentColor" d={CONTACTS_PAGE_PATH} />
      </svg>
    );
  },
);

export const EmailJunkIcon = forwardRef<SVGSVGElement, MailActionIconProps>(
  function EmailJunkIcon(props, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        {...props}>
        <path fill="currentColor" d={EMAIL_JUNK_PATH} />
      </svg>
    );
  },
);

export const EmailAutoTagIcon = forwardRef<SVGSVGElement, MailActionIconProps>(
  function EmailAutoTagIcon(props, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        {...props}>
        <path d="M0 0h24v24H0z" fill="none" />
        <defs>
          <path id="SVG50KS6Lfb" d={EMAIL_AUTO_TAG_PATH} />
        </defs>
        <g fill="none">
          <use href="#SVG50KS6Lfb" />
          <use href="#SVG50KS6Lfb" stroke="currentColor" strokeWidth={2} />
          <path
            stroke="currentColor"
            strokeWidth={2}
            d={EMAIL_AUTO_TAG_SPARKLE_PATH}
          />
        </g>
      </svg>
    );
  },
);

export const EmailSummaryIcon = forwardRef<SVGSVGElement, MailActionIconProps>(
  function EmailSummaryIcon(props, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        {...props}>
        <g fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="square" d={EMAIL_SUMMARY_PATH} />
          <path d={EMAIL_SUMMARY_SPARKLE_PATH} />
        </g>
      </svg>
    );
  },
);

export const EmailSweepIcon = forwardRef<SVGSVGElement, MailActionIconProps>(
  function EmailSweepIcon(props, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 1200 1200"
        {...props}>
        <path fill="currentColor" d={EMAIL_SWEEP_PATH} />
      </svg>
    );
  },
);

export const EmailSendIcon = forwardRef<SVGSVGElement, MailActionIconProps>(
  function EmailSendIcon(props, ref) {
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
          fillRule="evenodd"
          d="M4 3.5a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-10v-1H14V4.6L9.777 7.417a.5.5 0 0 1-.554 0L5 4.601V6.5a.5.5 0 0 1-.5.5H1V6h3zM7 8v1H2V8zm1 3H3v-1h5z"
          clipRule="evenodd"
        />
      </svg>
    );
  },
);

export const EmailSendPlaneIcon = forwardRef<SVGSVGElement, MailActionIconProps>(
  function EmailSendPlaneIcon(props, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        {...props}>
        <g fill="none">
          <path d="M2 3.5L21.5 12L2 20.5L5 12z" />
          <path
            stroke="currentColor"
            strokeLinecap="square"
            strokeWidth={2}
            d="m5 12l-3 8.5L21.5 12L2 3.5zm0 0h5"
          />
        </g>
      </svg>
    );
  },
);

export const EmailReplyIcon = forwardRef<SVGSVGElement, MailActionIconProps>(
  function EmailReplyIcon(props, ref) {
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
          d="M8 9.8v.9l1.7.3c2.6.4 4.5 1.4 5.9 2.7c-1.7-.5-3.5-.8-5.6-.8H8v1.3L5.8 12zM10 5l-7 7l7 7v-4.1c5 0 8.5 1.6 11 5.1c-1-5-4-10-11-11"
        />
      </svg>
    );
  },
);

export const EmailReplyAllIcon = forwardRef<SVGSVGElement, MailActionIconProps>(
  function EmailReplyAllIcon(props, ref) {
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
          d="M11 9.8v.9l1.7.2c2.6.4 4.5 1.4 5.9 2.7c-1.7-.5-3.5-.8-5.6-.8h-2v1.3L8.8 12zM13 5l-7 7l7 7v-4.1c5 0 8.5 1.6 11 5.1c-1-5-4-10-11-11M7 8V5l-7 7l7 7v-3l-4-4"
        />
      </svg>
    );
  },
);

export const EmailForwardIcon = forwardRef<SVGSVGElement, MailActionIconProps>(
  function EmailForwardIcon(props, ref) {
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
          d="M14 5v4C7 10 4 15 3 20c2.5-3.5 6-5.1 11-5.1V19l7-7zm2 4.83L18.17 12L16 14.17V12.9h-2c-2.07 0-3.93.38-5.66.95c1.4-1.39 3.2-2.48 5.94-2.85l1.72-.27z"
        />
      </svg>
    );
  },
);

/** Reading-pane "show details" disclosure toggle icon. */
export const DetailsBlockIcon = forwardRef<SVGSVGElement, MailActionIconProps>(
  function DetailsBlockIcon(props, ref) {
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
          d="M2 21L12 3l10 18zm3.4-2H11V8.925zm7.6 0h5.6L13 8.925z"
        />
      </svg>
    );
  },
);

/** Reading-pane "AI summary" disclosure toggle icon. */
export const AiFileIcon = forwardRef<SVGSVGElement, AiSummaryIconProps>(
  function AiFileIcon({ filled = false, ...props }, ref) {
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
          d={filled ? AI_SUMMARY_FILLED_PATH : AI_SUMMARY_OUTLINE_PATH}
        />
      </svg>
    );
  },
);

/** Email-list "important" marker (filled label_important glyph). */
export const EmailImportantIcon = forwardRef<
  SVGSVGElement,
  MailActionIconProps
>(function EmailImportantIcon(props, ref) {
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
        d="m2 20l6-8l-6-8h13q.475 0 .9.213t.7.587L22 12l-5.4 7.2q-.275.375-.7.588T15 20z"
      />
    </svg>
  );
});

/** Email-list "not important" marker (outline label_important glyph). */
export const EmailImportantOutlineIcon = forwardRef<
  SVGSVGElement,
  MailActionIconProps
>(function EmailImportantOutlineIcon(props, ref) {
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
        d="m2 20l6-8l-6-8h13q.475 0 .9.213t.7.587L22 12l-5.4 7.2q-.275.375-.7.588T15 20zm4-2h9l4.5-6L15 6H6l4.5 6zm6.75-6"
      />
    </svg>
  );
});

/** Sender is not yet a contact, offer to add them. */
export function AddSenderContactIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...props}>
      <path
        fill="currentColor"
        d="M14 11h7V6h-7zm3.5-1.25L15 8V7l2.5 1.75L20 7v1zM2 21q-.825 0-1.412-.587T0 19V5q0-.825.588-1.412T2 3h20q.825 0 1.413.588T24 5v14q0 .825-.587 1.413T22 21zm13.9-2H22V5H2v14h.1q1.05-1.875 2.9-2.937T9 15t4 1.063T15.9 19m-4.775-5.875Q12 12.25 12 11t-.875-2.125T9 8t-2.125.875T6 11t.875 2.125T9 14t2.125-.875M4.55 19h8.9q-.85-.95-2.013-1.475T9 17t-2.425.525T4.55 19m3.737-7.288Q8 11.425 8 11t.288-.712T9 10t.713.288T10 11t-.288.713T9 12t-.712-.288M12 12"
      />
    </svg>
  );
}

/** Sender is already a contact, offer to remove them. */
export function RemoveSenderContactIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...props}>
      <path
        fill="currentColor"
        d="M14 11h7V6h-7zm3.5-1.25L15 8V7l2.5 1.75L20 7v1zM2 21q-.825 0-1.412-.587T0 19V5q0-.825.588-1.412T2 3h20q.825 0 1.413.588T24 5v14q0 .825-.587 1.413T22 21zm9.125-7.875Q12 12.25 12 11t-.875-2.125T9 8t-2.125.875T6 11t.875 2.125T9 14t2.125-.875M2.1 19h13.8q-1.05-1.875-2.9-2.937T9 15t-4 1.063T2.1 19"
      />
    </svg>
  );
}
