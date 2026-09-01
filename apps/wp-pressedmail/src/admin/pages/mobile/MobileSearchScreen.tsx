"use client";

import * as React from "react";
import { useNavigate } from "react-router-dom";

import {
  FilterChipsRow,
  MobileScreen,
  MobileScreenHeader,
  MobileSearchInput,
  useHideTabBar,
} from "@/components/mobile-shell";
import { useInboxState, useMessageOperations } from "@/context/InboxContext";
import { getReadableMessagePreview } from "@/lib/email-content-normalization";
import {
  getMessageIdentityKey,
  getMessageListRowKeys,
} from "@/lib/message-identity";
import { cn } from "@/lib/utils";
import type { EmailMessage } from "@/types";

function getFromDisplay(mail: EmailMessage): string {
  if (mail.name) return mail.name;
  if (mail.email) return mail.email;
  if (mail.from) return mail.from;
  return "Unknown";
}

function SearchResultRow({
  mail,
  onOpen,
}: {
  mail: EmailMessage;
  onOpen: () => void;
}) {
  const preview = getReadableMessagePreview(mail);
  return (
    <button
      type="button"
      data-pm-mail-row
      onClick={onOpen}
      className="pm-no-tap-highlight flex w-full flex-col gap-1 p-4 text-left active:bg-muted/50">
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "min-w-0 truncate text-sm",
            !mail.read && "font-semibold",
          )}>
          {getFromDisplay(mail)}
        </span>
        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
          {mail.date ? new Date(mail.date).toLocaleDateString() : ""}
        </span>
      </div>
      <span
        className={cn(
          "min-w-0 truncate text-sm",
          !mail.read ? "font-medium text-foreground" : "text-muted-foreground",
        )}>
        {mail.subject || "(No subject)"}
      </span>
      {preview ? (
        <span className="line-clamp-2 text-xs text-muted-foreground">
          {preview}
        </span>
      ) : null}
    </button>
  );
}

export function MobileSearchScreen() {
  useHideTabBar(true);
  const navigate = useNavigate();
  const { messages, isLoading } = useInboxState();
  const { selectMessage } = useMessageOperations();
  const [query, setQuery] = React.useState("");
  const [scope, setScope] = React.useState<"all" | "unread">("all");

  const results = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    return messages.filter((mail) => {
      if (scope === "unread" && mail.read) return false;
      return [
        getFromDisplay(mail),
        mail.subject,
        getReadableMessagePreview(mail),
        mail.from,
        mail.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [messages, query, scope]);

  const resultKeys = React.useMemo(
    () => getMessageListRowKeys(results),
    [results],
  );

  const handleOpen = React.useCallback(
    (mail: EmailMessage) => {
      const id = getMessageIdentityKey(mail);
      void selectMessage(mail);
      navigate(`/inbox/m/${encodeURIComponent(id)}`);
    },
    [navigate, selectMessage],
  );

  return (
    <MobileScreen
      header={
        <MobileScreenHeader
          title="Search"
          onCancel={() => {
            setQuery("");
            navigate("/inbox");
          }}
        />
      }>
      <div className="flex min-h-full flex-col">
        <div className="border-b border-border px-3 py-2">
          <MobileSearchInput
            id="pm-mobile-dedicated-search"
            label="Search mail"
            placeholder="Search mail"
            value={query}
            onChange={setQuery}
            onClear={() => setQuery("")}
            autoFocus
          />
        </div>
        <FilterChipsRow
          value={scope}
          chips={[
            { id: "all", label: "All" },
            { id: "unread", label: "Unread" },
          ]}
          onSelect={(next) => {
            if (next === "all" || next === "unread") {
              setScope(next);
            }
          }}
        />
        {isLoading ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Loading messages...
          </p>
        ) : null}
        {!query.trim() ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Search by sender, subject, or message text
          </p>
        ) : null}
        {query.trim() && results.length === 0 && !isLoading ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No messages match your search
          </p>
        ) : null}
        <ul role="list" className="divide-y divide-border">
          {results.map((mail, index) => {
            const id = getMessageIdentityKey(mail);
            return (
              <li key={resultKeys[index] ?? id}>
                <SearchResultRow mail={mail} onOpen={() => handleOpen(mail)} />
              </li>
            );
          })}
        </ul>
      </div>
    </MobileScreen>
  );
}

export default MobileSearchScreen;
