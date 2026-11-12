/**
 * The add/edit account wizard's "Import contacts and calendars" block (Pro).
 *
 * The person picks Contacts and/or Calendars and how often: keep in sync
 * (hourly) or import once. Both are read-only. How each import connects
 * depends on the mailbox:
 *
 * - Outlook: a second sign-in, because a mail grant never carries contacts
 *   or calendar access. The popup parks the grant now; the import attaches it
 *   to the mailbox once the account is saved.
 * - Gmail, iCloud and Yahoo on an app password: CardDAV/CalDAV with the app
 *   password just entered for the mailbox, or the one it already stores when
 *   editing. No extra prompt. Google sign-in for contacts and calendars waits
 *   for Google's verification, so Gmail needs no OAuth approval here.
 * - Anything else: the Contacts & calendars settings page, which takes a
 *   server URL.
 *
 * The wizard calls the runner it receives through `runnerRef` with the saved
 * account's id. An import that fails never undoes the account.
 */
import * as React from "react";
import { __, sprintf } from "@wordpress/i18n";
import { CalendarClock, Contact } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  RadioGroup,
  RadioGroupItem,
  Switch,
  toast,
} from "@kit/ui/plugin";

import { OAuthConnectButton } from "@/components/setup/OAuthConnectButton";
import {
  connectDavImport,
  connectOAuthImport,
  type AccountImports,
  type ImportKind,
  type ImportMode,
  type OAuthImportProvider,
} from "@/lib/provider-import";
import {
  calendarImportBuildEnabled,
  contactsImportBuildEnabled,
} from "@/lib/provider-import-flags";
import { isGoogleSyncOAuthEnabled } from "@/lib/provider-gate";
import type { ProviderKey } from "../types";

type ImportRoute =
  | { via: "oauth"; provider: OAuthImportProvider }
  | { via: "dav"; url: string }
  | { via: "settings" };

/** How each import reaches this kind of mailbox. null: not offered. */
export function importRoutes(
  provider: ProviderKey | "",
  useOAuth: boolean,
  googleSignIn: boolean = isGoogleSyncOAuthEnabled(),
): Record<ImportKind, ImportRoute | null> {
  switch (provider) {
    case "outlook":
      return {
        contacts: { via: "oauth", provider: "outlook" },
        calendar: { via: "oauth", provider: "outlook" },
      };
    case "gmail": {
      // A Gmail mailbox on its app password imports over CardDAV and CalDAV.
      // One signed in with Google needs Google sign-in, which waits for approval.
      const signIn: ImportRoute = googleSignIn
        ? { via: "oauth", provider: "google" }
        : { via: "settings" };
      return useOAuth
        ? { contacts: signIn, calendar: signIn }
        : {
            contacts: {
              via: "dav",
              url: "https://www.googleapis.com/carddav/v1/principals/{email}/lists/default/",
            },
            calendar: {
              via: "dav",
              url: "https://www.google.com/calendar/dav/{email}/events/",
            },
          };
    }
    case "icloud":
      return useOAuth
        ? { contacts: null, calendar: null }
        : {
            contacts: { via: "dav", url: "https://contacts.icloud.com" },
            calendar: { via: "dav", url: "https://caldav.icloud.com" },
          };
    case "yahoo":
      return useOAuth
        ? { contacts: null, calendar: null }
        : {
            contacts: { via: "dav", url: "https://carddav.address.yahoo.com" },
            calendar: { via: "dav", url: "https://caldav.calendar.yahoo.com" },
          };
    case "custom":
      return {
        contacts: { via: "settings" },
        calendar: { via: "settings" },
      };
    default:
      return { contacts: null, calendar: null };
  }
}

/** Resolves true when at least one import was connected. */
export type ImportRunner = (accountId: number) => Promise<boolean>;

export interface ImportContactsCalendarsProps {
  provider: ProviderKey | "";
  useOAuth: boolean;
  /** The mailbox sign-in name: the DAV username for app-password imports. */
  username: string;
  password: string;
  /** Imports this mailbox already has (editing). Those show their state instead of a switch. */
  existing?: AccountImports;
  runnerRef: React.MutableRefObject<ImportRunner | null>;
}

const KINDS: Array<{
  kind: ImportKind;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    kind: "contacts",
    label: __("Contacts", "pressedmail"),
    icon: <Contact className="h-4 w-4" aria-hidden="true" />,
  },
  {
    kind: "calendar",
    label: __("Calendars", "pressedmail"),
    icon: <CalendarClock className="h-4 w-4" aria-hidden="true" />,
  },
];

export function ImportContactsCalendars({
  provider,
  useOAuth,
  username,
  password,
  existing,
  runnerRef,
}: ImportContactsCalendarsProps) {
  const routes = React.useMemo(() => {
    const all = importRoutes(provider, useOAuth);
    return {
      contacts:
        contactsImportBuildEnabled && !existing?.contacts ? all.contacts : null,
      calendar:
        calendarImportBuildEnabled && !existing?.calendar ? all.calendar : null,
    };
  }, [provider, useOAuth, existing]);
  const [chosen, setChosen] = React.useState<Record<ImportKind, boolean>>({
    contacts: false,
    calendar: false,
  });
  const [signedIn, setSignedIn] = React.useState<Record<ImportKind, boolean>>({
    contacts: false,
    calendar: false,
  });
  const [mode, setMode] = React.useState<ImportMode>("sync");

  React.useEffect(() => {
    runnerRef.current = async (accountId: number) => {
      let connected = false;
      for (const { kind, label } of KINDS) {
        const route = routes[kind];
        if (!chosen[kind] || !route || route.via === "settings") continue;
        if (route.via === "oauth" && !signedIn[kind]) {
          toast.error(
            sprintf(
              /* translators: %s: Contacts or Calendars */
              __(
                "%s were not imported: the sign-in was not finished. Set it up from Settings, Contacts & calendars.",
                "pressedmail",
              ),
              label,
            ),
          );
          continue;
        }
        // No password typed (editing): the server reuses the one the mailbox stores.
        const result =
          route.via === "oauth"
            ? await connectOAuthImport(kind, route.provider, accountId, mode)
            : await connectDavImport(
                kind,
                {
                  // A preset URL that names the account carries {email}.
                  url: password
                    ? route.url.replace("{email}", encodeURIComponent(username))
                    : route.url,
                  username: password ? username : "",
                  password,
                },
                accountId,
                mode,
              );
        if (result.success) {
          connected = true;
          toast.success(
            mode === "two_way" && result.mode && result.mode !== "two_way"
              ? sprintf(
                  /* translators: %s: Contacts or Calendars */
                  __("%s are importing from this account. This server only allows reading, so they stay in sync one way.", "pressedmail"),
                  label,
                )
              : sprintf(
                  /* translators: %s: Contacts or Calendars */
                  __("%s are importing from this account.", "pressedmail"),
                  label,
                ),
          );
        } else {
          toast.error(result.error);
        }
      }
      return connected;
    };
    return () => {
      runnerRef.current = null;
    };
  }, [chosen, signedIn, mode, routes, username, password, runnerRef]);

  const already = KINDS.filter(({ kind }) => existing?.[kind]);
  if (!routes.contacts && !routes.calendar && already.length === 0) {
    return null;
  }

  const anyChosen = chosen.contacts || chosen.calendar;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          {__("Import contacts and calendars", "pressedmail")}
        </CardTitle>
        <CardDescription>
          {__(
            "Read-only. PressedMail copies them in and never writes anything back.",
            "pressedmail",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {already.map(({ kind, label, icon }) => (
          <p
            key={kind}
            className="flex items-center gap-2 text-sm text-muted-foreground"
            data-test={`account-import-${kind}-existing`}>
            {icon}
            {sprintf(
              /* translators: 1: Contacts or Calendars, 2: keep in sync or import once */
              __("%1$s: already importing (%2$s).", "pressedmail"),
              label,
              existing?.[kind]?.mode === "once"
                ? __("imported once", "pressedmail")
                : existing?.[kind]?.mode === "two_way"
                  ? __("synced both ways", "pressedmail")
                  : __("kept in sync", "pressedmail"),
            )}
          </p>
        ))}
        {KINDS.map(({ kind, label, icon }) => {
          const route = routes[kind];
          if (!route) return null;
          const id = `account-import-${kind}`;
          return (
            <div key={kind} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                {/* The kit Switch generates its own id, so htmlFor cannot name it: aria-labelledby does. */}
                <Label
                  id={`${id}-label`}
                  htmlFor={id}
                  className="flex items-center gap-2">
                  {icon}
                  {label}
                </Label>
                <Switch
                  id={id}
                  aria-labelledby={`${id}-label`}
                  data-test={`account-import-${kind}-toggle`}
                  checked={chosen[kind]}
                  onCheckedChange={(checked: boolean) =>
                    setChosen((current) => ({ ...current, [kind]: checked }))
                  }
                />
              </div>
              {chosen[kind] && route.via === "oauth" && (
                <OAuthConnectButton
                  provider={
                    route.provider === "outlook" ? "microsoft" : "google"
                  }
                  purpose={kind}
                  connected={signedIn[kind]}
                  onConnected={() =>
                    setSignedIn((current) => ({ ...current, [kind]: true }))
                  }
                  onError={(message) => toast.error(message)}
                />
              )}
              {chosen[kind] && route.via === "dav" && (
                <p className="text-xs text-muted-foreground">
                  {__(
                    "Uses the app password you entered for this mailbox.",
                    "pressedmail",
                  )}
                </p>
              )}
              {chosen[kind] && route.via === "settings" && (
                <p className="text-xs text-muted-foreground">
                  {__(
                    "This server needs its own address. After saving, open Settings, Contacts & calendars, and add it under CardDAV and CalDAV.",
                    "pressedmail",
                  )}
                </p>
              )}
            </div>
          );
        })}
        {anyChosen && (
          <RadioGroup
            value={mode}
            onValueChange={(value: string) => setMode(value as ImportMode)}
            className="grid gap-2 sm:grid-cols-3"
            aria-label={__("How often to import", "pressedmail")}>
            <Label className="flex items-center gap-2 font-normal">
              <RadioGroupItem
                value="sync"
                aria-label={__("Keep in sync (every hour)", "pressedmail")}
              />
              {__("Keep in sync (every hour)", "pressedmail")}
            </Label>
            <Label className="flex items-center gap-2 font-normal">
              <RadioGroupItem
                value="once"
                aria-label={__("Import once", "pressedmail")}
              />
              {__("Import once", "pressedmail")}
            </Label>
            <Label className="flex items-center gap-2 font-normal">
              <RadioGroupItem
                value="two_way"
                aria-label={__("Two-way (edits here go back)", "pressedmail")}
              />
              {__("Two-way (edits here go back)", "pressedmail")}
            </Label>
          </RadioGroup>
        )}
      </CardContent>
    </Card>
  );
}

export default ImportContactsCalendars;
