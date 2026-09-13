"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";
import {
  ChevronRight,
  ExternalLink,
  LayoutGrid,
  LifeBuoy,
  MailWarning,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { MobileScreen, MobileScreenHeader } from "@/components/mobile-shell";
import { docsHref } from "@/components/settings-ui";

const SUPPORT_FORUM_URL = "https://wordpress.org/support/plugin/pressedmail/";

interface HelpEntry {
  id: string;
  icon: LucideIcon;
  title: string;
  body: string;
  /** In-app route. Mutually exclusive with `href`. */
  to?: string;
  /** External destination, opened in a new tab. */
  href?: string;
}

function HelpRow({
  entry,
  onNavigate,
}: {
  entry: HelpEntry;
  onNavigate: (to: string) => void;
}) {
  const Icon = entry.icon;
  const content = (
    <>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold text-foreground">
          {entry.title}
        </span>
        <span className="text-sm text-muted-foreground">{entry.body}</span>
      </span>
      {/* A chevron for somewhere inside the app, the external-link glyph only
          for somewhere outside it. Both used to be the external glyph. */}
      {entry.to ? (
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      ) : entry.href ? (
        <ExternalLink
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  const rowClass =
    "pm-touch-target pm-no-tap-highlight flex w-full items-start gap-3 px-3 py-3 text-left active:bg-muted";

  // Every child of the list is an <li>. A bare <button> sat directly inside
  // <ul role="list">, which is not a valid child and drops out of the list
  // semantics a screen reader announces.
  return (
    <li className="border-b border-border last:border-b-0">
      {entry.href ? (
        <a
          href={entry.href}
          target="_blank"
          rel="noreferrer noopener"
          className={rowClass}>
          {content}
        </a>
      ) : entry.to ? (
        <button
          type="button"
          onClick={() => onNavigate(entry.to!)}
          className={rowClass}>
          {content}
        </button>
      ) : (
        <span className={rowClass}>{content}</span>
      )}
    </li>
  );
}

/**
 * Phone help screen.
 *
 * It is called Help & Docs, so it links to the docs and to the support forum:
 * it used to contain three text cards and not a single anchor, which left
 * anyone with a real problem nowhere to go. The copy is plain words rather
 * than internal vocabulary ("mobile shell", "mailto handling").
 */
export function MobileHelpScreen() {
  const navigate = useNavigate();

  const entries = React.useMemo<HelpEntry[]>(
    () => [
      {
        id: "getting-started",
        icon: LifeBuoy,
        title: __("Getting started", "pressedmail"),
        body: __(
          "Set up your mailbox and learn your way around PressedMail.",
          "pressedmail",
        ),
        href: docsHref("getting-started"),
      },
      {
        id: "troubleshooting",
        icon: Wrench,
        title: __("Troubleshooting", "pressedmail"),
        body: __(
          "Mail not arriving, or something looks wrong? Start here.",
          "pressedmail",
        ),
        href: docsHref("troubleshooting"),
      },
      {
        id: "support",
        icon: LifeBuoy,
        title: __("Ask for help", "pressedmail"),
        body: __(
          "Post a question on the PressedMail support forum.",
          "pressedmail",
        ),
        href: SUPPORT_FORUM_URL,
      },
      {
        id: "install",
        icon: LayoutGrid,
        title: __("Add to Home Screen", "pressedmail"),
        body: __("Keep PressedMail one tap away, like an app.", "pressedmail"),
        to: "/install",
      },
      {
        id: "mailto",
        icon: MailWarning,
        title: __("Default email app", "pressedmail"),
        body: __(
          "Your phone cannot make PressedMail its default mail app, but your browser can open mail links in it.",
          "pressedmail",
        ),
        to: "/install",
      },
    ],
    [],
  );

  return (
    <MobileScreen
      header={<MobileScreenHeader title={__("Help & Docs", "pressedmail")} />}>
      <div className="flex flex-col gap-4 px-3 py-4">
        {/* The header already names the screen; the card heading that repeated
            it word for word is gone. */}
        <p className="px-1 pt-1 text-sm text-muted-foreground">
          {__(
            "Guides, fixes, and somewhere to ask when PressedMail is not doing what you expect.",
            "pressedmail",
          )}
        </p>

        <ul
          role="list"
          className="overflow-hidden rounded-xl border border-border bg-card">
          {entries.map((entry) => (
            <HelpRow key={entry.id} entry={entry} onNavigate={navigate} />
          ))}
        </ul>
      </div>
    </MobileScreen>
  );
}

export default MobileHelpScreen;
