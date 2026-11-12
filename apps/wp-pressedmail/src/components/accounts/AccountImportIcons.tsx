/**
 * The Accounts table's import cue (Pro): a contacts and/or calendar icon for
 * each import this mailbox has, a refresh mark when it is kept in sync, and a
 * warning tone when its last pull failed. The wording is the accessible name
 * and the tooltip; the button opens the Contacts & calendars settings page.
 */
import { __, sprintf } from "@wordpress/i18n";
import { CalendarClock, Contact, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { cn } from "@kit/ui/plugin";

import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import type { AccountImportState, AccountImports } from "@/lib/provider-import";

const PROVIDER_NAMES: Record<string, string> = {
  google: "Google",
  outlook: "Outlook",
  carddav: "CardDAV",
  caldav: "CalDAV",
};

function describe(kind: "contacts" | "calendar", state: AccountImportState) {
  const provider = PROVIDER_NAMES[state.provider] ?? state.provider;
  if (state.status === "error") {
    return kind === "contacts"
      ? /* translators: %s: provider name, such as Google */
        sprintf(__("Contacts from %s: the last import failed", "pressedmail"), provider)
      : /* translators: %s: provider name, such as Google */
        sprintf(__("Calendars from %s: the last import failed", "pressedmail"), provider);
  }
  if (state.mode === "two_way") {
    return kind === "contacts"
      ? /* translators: %s: provider name, such as Google */
        sprintf(__("Contacts synced both ways with %s", "pressedmail"), provider)
      : /* translators: %s: provider name, such as Google */
        sprintf(__("Calendars synced both ways with %s", "pressedmail"), provider);
  }
  if (state.mode === "once") {
    return kind === "contacts"
      ? /* translators: %s: provider name, such as Google */
        sprintf(__("Contacts imported once from %s", "pressedmail"), provider)
      : /* translators: %s: provider name, such as Google */
        sprintf(__("Calendars imported once from %s", "pressedmail"), provider);
  }
  return kind === "contacts"
    ? /* translators: %s: provider name, such as Google */
      sprintf(__("Contacts kept in sync from %s, hourly", "pressedmail"), provider)
    : /* translators: %s: provider name, such as Google */
      sprintf(__("Calendars kept in sync from %s, hourly", "pressedmail"), provider);
}

export function AccountImportIcons({ imports }: { imports?: AccountImports }) {
  const navigate = useNavigate();
  const entries = (
    [
      ["contacts", imports?.contacts, Contact],
      ["calendar", imports?.calendar, CalendarClock],
    ] as const
  ).filter(([, state]) => state);

  if (entries.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {__("None", "pressedmail")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {entries.map(([kind, state, Icon]) => {
        const label = describe(kind, state!);
        return (
          <PressedTooltip key={kind} content={label} side="top">
            <button
              type="button"
              aria-label={label}
              data-test={`account-import-icon-${kind}`}
              onClick={() => navigate("/settings/contacts-calendars")}
              className={cn(
                "inline-flex items-center gap-0.5 rounded p-0.5 hover:bg-muted",
                state!.status === "error" ? "text-destructive" : "text-primary",
              )}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {state!.mode === "sync" && (
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
              )}
            </button>
          </PressedTooltip>
        );
      })}
    </span>
  );
}
