"use client";

import * as React from "react";
import { __, _n, sprintf } from "@wordpress/i18n";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  FilterChipsRow,
  MobileScreen,
  MobileScreenHeader,
  MobileSearchInput,
  useHideTabBar,
} from "@/components/mobile-shell";
import {
  useFolderOperations,
  useInboxState,
  useMessageOperations,
  useSearchOperations,
} from "@/context/InboxContext";
import { buildEmailRowViewModel } from "@/components/inbox/email-row-model";
import { getReadableMessagePreview } from "@/lib/email-content-normalization";
import {
  getMessageIdentityKey,
  getMessageListRowKeys,
} from "@/lib/message-identity";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/services/interfaces";
import { PaginationFooter } from "@/layouts/shared/components/footer-system";
import type { EmailMessage } from "@/types";

/** Keystroke settling time before a search reaches the server. */
const SEARCH_DEBOUNCE_MS = 350;

function getFromDisplay(mail: EmailMessage): string {
  if (mail.name) return mail.name;
  if (mail.email) return mail.email;
  if (mail.from) return mail.from;
  return __("Unknown", "pressedmail");
}

function SearchResultRow({
  mail,
  onOpen,
}: {
  mail: EmailMessage;
  onOpen: () => void;
}) {
  const preview = getReadableMessagePreview(mail);
  // The desktop row model, so a result reads "9:03 AM" / "Thu" / "Sep 9"
  // rather than the raw "9/10/2026" every row used to show.
  const model = buildEmailRowViewModel(mail);
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
          {model.dateLabel}
        </span>
      </div>
      <span
        className={cn(
          "min-w-0 truncate text-sm",
          !mail.read ? "font-medium text-foreground" : "text-muted-foreground",
        )}>
        {mail.subject || __("(No subject)", "pressedmail")}
      </span>
      {preview ? (
        <span className="line-clamp-2 text-xs text-muted-foreground">
          {preview}
        </span>
      ) : null}
    </button>
  );
}

/** Searches synced mail across folders without changing the inbox's filters or page. */
export function MobileSearchScreen() {
  useHideTabBar(true);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { selectedAccountId } = useInboxState();
  const { selectedFolder } = useFolderOperations();
  const { selectMessage } = useMessageOperations();
  const { search } = useSearchOperations();
  const query = params.get("q") ?? "";
  const trimmed = query.trim();
  const unread = params.get("unread") === "1";
  const currentFolderOnly = params.get("folderScope") === "current";
  const requestedPage = Number(params.get("page"));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const pageSize = 25;
  const [retry, setRetry] = React.useState(0);
  const [answer, setAnswer] = React.useState<{
    key: string;
    result: SearchResult;
  } | null>(null);
  const key = JSON.stringify([
    trimmed,
    unread,
    currentFolderOnly ? selectedFolder : "",
    selectedAccountId,
    page,
    retry,
  ]);
  const liveSearch = React.useRef(search);
  liveSearch.current = search;

  const updateQuery = (name: string, value: string) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(name, value);
        else next.delete(name);
        if (name !== "page") next.delete("page");
        return next;
      },
      { replace: true },
    );
  };

  React.useEffect(() => {
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const result = await liveSearch.current(trimmed, {
          accountId: selectedAccountId ?? undefined,
          folder: currentFolderOnly ? selectedFolder : undefined,
          readStatus: unread ? "unread" : undefined,
          offset: (page - 1) * pageSize,
          limit: pageSize,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setAnswer({ key, result });
      } catch (error) {
        if (!controller.signal.aborted)
          setAnswer({
            key,
            result: {
              messages: [],
              total: 0,
              suggestions: [],
              error: error instanceof Error ? error.message : "Search failed",
            },
          });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    currentFolderOnly,
    key,
    page,
    selectedAccountId,
    selectedFolder,
    trimmed,
    unread,
  ]);

  const ready = answer?.key === key ? answer.result : null;
  const searching = trimmed.length >= 2 && !ready;
  const error = ready?.error;
  const results = ready && !error ? ready.messages : [];
  const resultKeys = React.useMemo(
    () => getMessageListRowKeys(results),
    [results],
  );
  const handleOpen = (mail: EmailMessage) => {
    void selectMessage(mail);
    navigate(`/inbox/m/${encodeURIComponent(getMessageIdentityKey(mail))}`);
  };

  return (
    <MobileScreen
      header={
        <MobileScreenHeader
          title={__("Search", "pressedmail")}
          onCancel={() => navigate("/inbox")}
        />
      }
      footer={
        ready && !error && (ready.total > pageSize || page > 1) ? (
          <PaginationFooter
            currentPage={page}
            totalItems={ready.total}
            serverTotalItems={ready.total}
            pageSize={pageSize}
            hasMore={page * pageSize < ready.total}
            onPageChange={(next) => updateQuery("page", String(next))}
          />
        ) : null
      }>
      <div className="flex min-h-full flex-col">
        <div className="space-y-2 border-b border-border px-3 py-2">
          <MobileSearchInput
            id="pm-mobile-dedicated-search"
            label={__("Search mail", "pressedmail")}
            placeholder={__("Search mail", "pressedmail")}
            value={query}
            onChange={(value) => updateQuery("q", value)}
            onClear={() => updateQuery("q", "")}
            autoFocus
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {__("Search in", "pressedmail")}
            <select
              aria-label={__("Search folders", "pressedmail")}
              value={currentFolderOnly ? "current" : "all"}
              onChange={(event) =>
                updateQuery(
                  "folderScope",
                  event.target.value === "current" ? "current" : "",
                )
              }
              className="pm-touch-target min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground">
              <option value="all">{__("All folders", "pressedmail")}</option>
              <option value="current">{selectedFolder}</option>
            </select>
          </label>
        </div>
        <FilterChipsRow
          value={unread ? "unread" : "all"}
          chips={[
            { id: "all", label: __("All", "pressedmail") },
            { id: "unread", label: __("Unread", "pressedmail") },
          ]}
          onSelect={(next) =>
            updateQuery("unread", next === "unread" ? "1" : "")
          }
        />
        {error ? (
          <div role="alert" className="space-y-3 px-4 py-6 text-center">
            <p className="text-sm text-destructive">
              {__("Could not search your mail. Try again.", "pressedmail")}
            </p>
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
              className="pm-touch-target rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              {__("Retry", "pressedmail")}
            </button>
          </div>
        ) : (
          <p
            role="status"
            aria-live="polite"
            className={cn(
              "px-4 text-center text-sm text-muted-foreground",
              "py-3",
            )}>
            {searching
              ? __("Searching your mailbox...", "pressedmail")
              : trimmed.length < 2
                ? __(
                    "Enter at least two characters to search synced mail by sender, subject, or preview.",
                    "pressedmail",
                  )
                : ready?.total === 0
                  ? __("No messages match your search", "pressedmail")
                  : sprintf(
                      _n(
                        "%d result",
                        "%d results",
                        ready?.total ?? 0,
                        "pressedmail",
                      ),
                      ready?.total ?? 0,
                    )}
          </p>
        )}
        <ul role="list" className="divide-y divide-border">
          {results.map((mail, index) => (
            <li key={resultKeys[index] ?? getMessageIdentityKey(mail)}>
              <SearchResultRow mail={mail} onOpen={() => handleOpen(mail)} />
            </li>
          ))}
        </ul>
      </div>
    </MobileScreen>
  );
}

export default MobileSearchScreen;
