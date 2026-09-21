import type { SVGProps } from "react";

/**
 * Glyphs for the mail services PressedMail can connect to.
 *
 * Every one of these is drawn here: one 24x24 grid, one fill, plain geometry,
 * no markup from a drawing tool or an icon set. That is deliberate. The set
 * that used to live in this file came from at least four different exporters,
 * carried five coordinate systems and a hard-coded black fill, and nobody
 * could say which pack any of it came from or under what terms. A licence
 * nobody wrote down is a licence nobody can check, so it was replaced.
 *
 * They are used nominatively, to label a mail account by the service it talks
 * to. Each service's own logo stays its owner's trademark; none of it is
 * reproduced here, and no endorsement is claimed or implied.
 *
 * See apps/wp-pressedmail/THIRD-PARTY-PROVENANCE.md.
 */

type GlyphProps = SVGProps<SVGSVGElement>;

function Glyph({ children, ...props }: GlyphProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}>
      {children}
    </svg>
  );
}

/** Envelope whose flap folds into an M. */
export function GmailIcon(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M2 7a2.5 2.5 0 0 1 4-2l6 4.5L18 5a2.5 2.5 0 0 1 4 2v10.5a1.5 1.5 0 0 1-1.5 1.5H19v-9.2l-6.4 4.8a1 1 0 0 1-1.2 0L5 9.8V19H3.5A1.5 1.5 0 0 1 2 17.5V7Z" />
    </Glyph>
  );
}

/** Envelope with a ring beside it. */
export function OutlookIcon(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path
        fillRule="evenodd"
        d="M7 6c-2.2 0-3.8 2.5-3.8 6S4.8 18 7 18s3.8-2.5 3.8-6S9.2 6 7 6Zm0 2.2c.9 0 1.7 1.4 1.7 3.8S7.9 15.8 7 15.8 5.3 14.4 5.3 12 6.1 8.2 7 8.2Z"
        clipRule="evenodd"
      />
      <path d="M12.4 7.5H21a.8.8 0 0 1 .8.8v.4l-5.1 3.4-4.3-2.9V7.5Zm0 4.2 3.9 2.6a.8.8 0 0 0 .9 0l4.6-3.1v5.6a.8.8 0 0 1-.8.7h-8.6v-5.8Z" />
    </Glyph>
  );
}

/** A Y. */
export function YahooIcon(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M3 5h3.6l3.7 5.9L14 5h3.6l-5.9 9.3V19h-3v-4.7L3 5Z" />
      <circle cx="19.2" cy="17.4" r="1.8" />
    </Glyph>
  );
}

/** A cloud. */
export function ICloudIcon(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M7.4 19a4.6 4.6 0 0 1-.7-9.1 5.6 5.6 0 0 1 10.5-1.4A4.3 4.3 0 0 1 17.3 19H7.4Z" />
    </Glyph>
  );
}

/** A shield holding an envelope. */
export function ProtonMailIcon(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path
        fillRule="evenodd"
        d="M12 2 4 4.9v6.4c0 4.4 3.3 8.4 8 9.7 4.7-1.3 8-5.3 8-9.7V4.9L12 2Zm-4.4 7.2h8.8v.3l-4.4 3-4.4-3v-.3Zm0 1.9 3.9 2.7a.9.9 0 0 0 1 0l3.9-2.7v4.3H7.6v-4.3Z"
        clipRule="evenodd"
      />
    </Glyph>
  );
}

/** A Z. */
export function ZohoIcon(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M4.5 4.5h15v2.9L9.4 17.1h10.1v2.4h-15v-2.9L14.6 6.9H4.5V4.5Z" />
    </Glyph>
  );
}

/** An A. */
export function AolIcon(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path
        fillRule="evenodd"
        d="M12 3.5 3.8 20.5h3.5l1.6-3.5h6.2l1.6 3.5h3.5L12 3.5Zm0 5.4 2 4.4h-4l2-4.4Z"
        clipRule="evenodd"
      />
    </Glyph>
  );
}

/** A plain envelope, for anything not on the list. */
export function EmailIcon(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path
        fillRule="evenodd"
        d="M3.8 5h16.4c1 0 1.8.8 1.8 1.8v10.4c0 1-.8 1.8-1.8 1.8H3.8c-1 0-1.8-.8-1.8-1.8V6.8C2 5.8 2.8 5 3.8 5Zm1 2L12 12.1 19.2 7H4.8ZM20 8.9l-7.4 5.3a1 1 0 0 1-1.2 0L4 8.9v8.1h16V8.9Z"
        clipRule="evenodd"
      />
    </Glyph>
  );
}
