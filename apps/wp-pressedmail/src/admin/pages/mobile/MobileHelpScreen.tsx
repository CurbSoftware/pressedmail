"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";
import {
  CircleHelp,
  ExternalLink,
  LayoutGrid,
  MailWarning,
  Wrench,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { MobileScreen, MobileScreenHeader } from "@/components/mobile-shell";

function HelpRow({
  icon: Icon,
  title,
  body,
  onClick,
}: {
  icon: React.ElementType<{
    className?: string;
    "aria-hidden"?: React.AriaAttributes["aria-hidden"];
  }>;
  title: string;
  body: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-sm text-muted-foreground">{body}</span>
      </span>
      {onClick ? (
        <ExternalLink
          className="h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="pm-touch-target pm-no-tap-highlight flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left last:border-b-0 active:bg-muted">
        {content}
      </button>
    );
  }

  return (
    <li className="flex items-start gap-3 border-b border-border px-3 py-3 last:border-b-0">
      {content}
    </li>
  );
}

export function MobileHelpScreen() {
  const navigate = useNavigate();
  return (
    <MobileScreen
      header={<MobileScreenHeader title={__("Help & Docs", "pressedmail")} />}>
      <div className="flex flex-col gap-4 px-3 py-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <CircleHelp
              className="mt-0.5 h-5 w-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div>
              <h1 className="text-base font-semibold text-foreground">
                {__("Help & Docs", "pressedmail")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {__(
                  "Quick help for the mobile PressedMail experience.",
                  "pressedmail",
                )}
              </p>
            </div>
          </div>
        </section>

        <ul
          role="list"
          className="overflow-hidden rounded-xl border border-border bg-card">
          <HelpRow
            icon={LayoutGrid}
            title={__("Add to Home Screen", "pressedmail")}
            body={__(
              "Install PressedMail from Safari or Chrome for faster mobile access.",
              "pressedmail",
            )}
            onClick={() => navigate("/install")}
          />
          <HelpRow
            icon={MailWarning}
            title={__("Default email client", "pressedmail")}
            body={__(
              "PressedMail cannot fully become your operating system default email app from inside WordPress. Browser mailto handling is the best available web behavior.",
              "pressedmail",
            )}
          />
          <HelpRow
            icon={Wrench}
            title={__("Troubleshooting", "pressedmail")}
            body={__(
              "If the mobile shell looks cramped, refresh the page and confirm the browser is not forcing desktop site mode.",
              "pressedmail",
            )}
          />
        </ul>
      </div>
    </MobileScreen>
  );
}

export default MobileHelpScreen;
