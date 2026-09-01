"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { __, sprintf } from "@wordpress/i18n";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleRow,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  toast,
} from "@kit/ui/plugin";
import { Brush } from "lucide-react";
import type { EmailMessage } from "@/types";
import type { ImapFolder } from "@/services/interfaces";
import {
  getFolderRole,
  getSweepMoveTargetFolders,
} from "@/lib/bulk-mail-actions";
import {
  getAccountQualifiedMessageToken,
  getMessageIdentityKey,
} from "@/lib/message-identity";
import {
  buildPerAccountPathDestination,
  buildRoleDestination,
  buildStableTargetDestination,
  collectPerAccountFolderUnion,
  folderDestinationKey,
  type FolderDestination,
} from "@/lib/folder-destination";
import type {
  StartOneOffSweepRequest,
  SweepMatchCriteria,
  SweepMatchType,
  SweepScope,
  SweepScopeMode,
  SweepSkippedAccount,
} from "@/services/one-off-sweep.service";
import { folderPathsEqual } from "@/services/filter-rule-folder-targets";

const EMAIL_RE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/;
const BRACKET_EMAIL_RE = /<([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})>/;
const MAX_VISIBLE_SWEEP_VALUES = 10;

const MATCH_TYPES: SweepMatchType[] = [
  "sender_email",
  "sender_domain",
  "subject_contains",
];

export function extractSenderEmail(input: string | undefined | null): string {
  if (!input) return "";
  const raw = String(input);
  const bracketed = raw.match(BRACKET_EMAIL_RE);
  if (bracketed?.[1]) return bracketed[1].toLowerCase();
  const plain = raw.match(EMAIL_RE);
  if (!plain?.[1]) return "";
  return plain[1].toLowerCase();
}

function messageSender(message: EmailMessage): string {
  return extractSenderEmail(message.from || message.email || "");
}

function senderDomain(sender: string): string {
  const email = extractSenderEmail(sender) || sender.toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email.slice(at + 1).trim();
}

function messageSubject(message: EmailMessage): string {
  return String(message.subject ?? "").trim();
}

function unique(values: string[]): string[] {
  const set = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed) set.add(trimmed);
  }
  return Array.from(set);
}

function matchLabel(type: SweepMatchType): string {
  if (type === "sender_domain") return __("Sender domain", "pressedmail");
  if (type === "subject_contains") return __("Subject contains", "pressedmail");
  return __("Sender email address", "pressedmail");
}

interface SweepFolderOption {
  /** Unique option key: NEVER a bare path (same-named folders collide). */
  value: string;
  name: string;
  role: string | null;
  destination: FolderDestination;
  /** Hint when the folder is missing on some in-scope accounts. */
  partialCoverage?: boolean;
}

type SelectedValuesByType = Record<SweepMatchType, string[]>;

/**
 * Live selection snapshot from the call site. `selectedCount` drives the
 * default scope choice; `excludedIds`/`totalCount` describe a select-all
 * selection for the entire-view scope.
 */
export interface EmailSweepSelection {
  selectedCount: number;
  excludedIds?: string[];
  totalCount?: number;
}

export interface EmailSweepProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMessages: EmailMessage[];
  scope: SweepScope;
  folders: ImapFolder[];
  onRun: (request: StartOneOffSweepRequest) => Promise<unknown> | unknown;
  selection?: EmailSweepSelection;
}

/** A numbered step heading. */
function SweepStep({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3" data-test={`sweep-step-${step}`}>
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xs font-semibold text-primary">
          {step}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-2 pl-7">{children}</div>
    </section>
  );
}

interface SweepSeed {
  tokens: string[];
  sampleCount: number;
  matchValues: SelectedValuesByType;
}

function deriveSeed(messages: EmailMessage[]): SweepSeed {
  const tokens = new Set<string>();
  for (const message of messages) {
    const token =
      getAccountQualifiedMessageToken(message) ||
      getMessageIdentityKey(message);
    if (token) tokens.add(token);
  }
  const senders = messages.map(messageSender);
  return {
    tokens: Array.from(tokens),
    sampleCount: messages.length,
    matchValues: {
      sender_email: unique(senders),
      sender_domain: unique(senders.map(senderDomain)),
      subject_contains: unique(messages.map(messageSubject)),
    },
  };
}

export function EmailSweep({
  open,
  onOpenChange,
  initialMessages,
  scope,
  folders,
  onRun,
  selection,
}: EmailSweepProps) {
  // Freeze everything derived from the selected rows at OPEN time: the list
  // refreshes underneath the dialog (sync poll, the sweep's own live refresh)
  // and re-derived values used to silently reset the user's choices mid-edit.
  const [seed, setSeed] = useState<SweepSeed>(() =>
    deriveSeed(initialMessages),
  );
  const wasOpenRef = useRef(false);

  const folderOptions = useMemo<SweepFolderOption[]>(() => {
    const scopeAccountIds = [
      ...new Set(scope.accountIds.filter((id) => id > 0)),
    ];
    const singleAccountId =
      scopeAccountIds.length === 1 ? scopeAccountIds[0] : null;
    const sourcePath = String(scope.folderPath ?? "");
    const options: SweepFolderOption[] = [];
    const seen = new Set<string>();
    const push = (option: SweepFolderOption) => {
      if (!seen.has(option.value)) {
        seen.add(option.value);
        options.push(option);
      }
    };

    if (singleAccountId !== null) {
      const flattened: Array<{ folder: ImapFolder; breadcrumb: string }> = [];
      const seenFolders = new Set<string>();
      const visit = (nodes: ImapFolder[], parents: string[]) => {
        for (const folder of nodes) {
          const crumbs = [...parents, folder.name];
          const key = `${folder.accountId ?? 0}:${folder.id ?? folder.path}`;
          if (!seenFolders.has(key)) {
            seenFolders.add(key);
            flattened.push({ folder, breadcrumb: crumbs.join(" / ") });
          }
          visit(folder.children ?? [], crumbs);
        }
      };
      visit(folders, []);

      const moveFolders = getSweepMoveTargetFolders(
        flattened.map(({ folder }) => folder),
      );
      for (const folder of moveFolders) {
        const role = getFolderRole(folder);
        const isJunk = role === "spam" || role === "junk";
        const isTrash = role === "trash";
        if (!isJunk && !isTrash) {
          if (folder.accountId !== singleAccountId) continue;
          if (typeof folder.id !== "number") continue;
          const path = String(folder.path ?? "");
          if (
            sourcePath !== "" &&
            folderPathsEqual(
              path,
              sourcePath,
              folder.delimiter,
              folder.delimiterState,
            )
          ) {
            continue;
          }
        } else if (
          folder.accountId != null &&
          folder.accountId !== singleAccountId
        ) {
          continue;
        }

        const destination: FolderDestination =
          isJunk || isTrash
            ? buildRoleDestination(isJunk ? "junk" : "trash")
            : buildStableTargetDestination({
                accountId: folder.accountId as number,
                folderId: folder.id as number,
                lastKnownPath: folder.path,
                status: "resolved",
              });
        push({
          value: folderDestinationKey(destination),
          name:
            flattened.find((entry) => entry.folder === folder)?.breadcrumb ??
            folder.name,
          role: isJunk ? "spam" : role,
          destination,
        });
      }
    } else {
      // Combined view: role targets that exist (or can be ensured) on every
      // account, plus ONE deduped union of every account's custom folders by
      // name chain, resolved, and created when missing, per account.
      for (const entry of collectPerAccountFolderUnion(folders)) {
        const destination = buildPerAccountPathDestination(
          entry.chain,
          entry.chain.join("/"),
          entry.known,
        );
        push({
          value: folderDestinationKey(destination),
          name: entry.displayPath,
          role: null,
          destination,
          partialCoverage:
            scopeAccountIds.length > 0 &&
            entry.accounts.length < scopeAccountIds.length,
        });
      }
      const archive = buildRoleDestination("archive");
      push({
        value: folderDestinationKey(archive),
        name: __("Archive", "pressedmail"),
        role: "archive",
        destination: archive,
      });
    }

    // Junk/Trash role fallbacks are always available in both scopes.
    if (!options.some((option) => option.role === "spam")) {
      const junk = buildRoleDestination("junk");
      push({
        value: folderDestinationKey(junk),
        name: __("Junk", "pressedmail"),
        role: "spam",
        destination: junk,
      });
    }
    if (!options.some((option) => option.role === "trash")) {
      const trash = buildRoleDestination("trash");
      push({
        value: folderDestinationKey(trash),
        name: __("Trash", "pressedmail"),
        role: "trash",
        destination: trash,
      });
    }

    return options;
  }, [folders, scope.accountIds, scope.folderPath]);

  const [scopeMode, setScopeMode] = useState<SweepScopeMode>("entire_view");
  const [matchType, setMatchType] = useState<SweepMatchType>("sender_email");
  const [selectedValuesByType, setSelectedValuesByType] =
    useState<SelectedValuesByType>(seed.matchValues);
  const [folderValue, setFolderValue] = useState("");
  const [createRule, setCreateRule] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    // One reset per OPEN, never mid-edit.
    const nextSeed = deriveSeed(initialMessages);
    setSeed(nextSeed);
    setScopeMode(
      (selection?.selectedCount ?? nextSeed.sampleCount) > 0
        ? "selected_only"
        : "entire_view",
    );
    setMatchType("sender_email");
    setSelectedValuesByType(nextSeed.matchValues);
    setCreateRule(false);
    setError(null);
    setFolderValue("");
  }, [open, initialMessages, selection?.selectedCount]);

  // Keep the destination valid without clobbering an explicit choice.
  useEffect(() => {
    if (!open) return;
    if (
      folderValue === "" ||
      !folderOptions.some((option) => option.value === folderValue)
    ) {
      setFolderValue(folderOptions[0]?.value ?? "");
    }
  }, [open, folderOptions, folderValue]);

  const matchValues = seed.matchValues;
  const availableValues = matchValues[matchType];
  const selectedValues = useMemo(
    () =>
      selectedValuesByType[matchType].filter((value) =>
        availableValues.includes(value),
      ),
    [availableValues, matchType, selectedValuesByType],
  );
  const selectedValueSet = useMemo(
    () => new Set(selectedValues),
    [selectedValues],
  );

  const toggleMatchValue = useCallback(
    (value: string, checked: boolean) => {
      setSelectedValuesByType((current) => {
        const next = new Set(current[matchType]);
        if (checked) next.add(value);
        else next.delete(value);
        return {
          ...current,
          [matchType]: Array.from(next),
        };
      });
      setError(null);
    },
    [matchType],
  );

  const handleConfirm = useCallback(() => {
    if (seed.tokens.length === 0) {
      setError(__("Select at least one sample message", "pressedmail"));
      return;
    }
    if (selectedValues.length === 0) {
      setError(__("Choose at least one match value", "pressedmail"));
      return;
    }
    const selectedFolder = folderOptions.find(
      (option) => option.value === folderValue,
    );
    if (!selectedFolder) {
      setError(__("Select a destination folder", "pressedmail"));
      return;
    }

    const match: SweepMatchCriteria = {
      type: matchType,
      values: selectedValues,
    };

    const request: StartOneOffSweepRequest = {
      selected_message_ids: seed.tokens,
      scope,
      action: "move",
      sweep_scope_mode: scopeMode,
      destination: selectedFolder.destination,
      match,
      create_rule: createRule,
    };
    if (scopeMode === "entire_view" && selection?.excludedIds?.length) {
      request.excluded_message_ids = selection.excludedIds;
    }

    // Fire-and-forget: the sweep runs in the activity queue, so close now and
    // surface enqueue failures as a toast.
    setError(null);
    onOpenChange(false);
    void Promise.resolve(onRun(request))
      .then((result) => {
        if (!result || typeof result !== "object") return;
        const payload = result as {
          rule_ids?: unknown;
          existing_rule_ids?: unknown;
          rule_error?: unknown;
          skipped_accounts?: unknown;
        };

        if (
          createRule &&
          ((Array.isArray(payload.rule_ids) && payload.rule_ids.length > 0) ||
            (Array.isArray(payload.existing_rule_ids) &&
              payload.existing_rule_ids.length > 0))
        ) {
          window.dispatchEvent(new CustomEvent("pm-filter-rules-changed"));
        }
        if (typeof payload.rule_error === "string" && payload.rule_error) {
          toast.warning(
            sprintf(
              /* translators: %s: rules-layer error message. */
              __(
                "Sweep queued, but the automation rule could not be created: %s",
                "pressedmail",
              ),
              payload.rule_error,
            ),
          );
        }
        const skipped = Array.isArray(payload.skipped_accounts)
          ? (payload.skipped_accounts as SweepSkippedAccount[])
          : [];
        if (skipped.length > 0) {
          toast.warning(
            sprintf(
              /* translators: %s: comma-separated skipped account emails. */
              __("Sweep skipped: %s", "pressedmail"),
              skipped
                .map(
                  (account) =>
                    `${account.email || account.account_id} (${
                      account.reason === "inactive"
                        ? __("account disabled", "pressedmail")
                        : __("folder not found", "pressedmail")
                    })`,
                )
                .join(", "),
            ),
          );
        }
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : String(err));
      });
  }, [
    createRule,
    folderValue,
    folderOptions,
    matchType,
    onOpenChange,
    onRun,
    scope,
    scopeMode,
    seed.tokens,
    selectedValues,
    selection,
  ]);

  const valuesShouldScroll = availableValues.length > MAX_VISIBLE_SWEEP_VALUES;
  const selectedValueSummary = selectedValues.join(", ");
  const selectedCount = selection?.selectedCount ?? seed.sampleCount;
  const excludedCount =
    scopeMode === "entire_view" ? (selection?.excludedIds?.length ?? 0) : 0;
  const currentOption = folderOptions.find(
    (option) => option.value === folderValue,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        data-test="sweep-dialog-content"
        data-testid="sweep-dialog-content"
        className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden border-border bg-card p-0 text-card-foreground">
        <DialogHeader className="border-b border-border bg-muted/20 px-4 py-3">
          <DialogTitle className="text-base">
            <DialogTitleRow>
              <Brush />
              <span>{__("Sweep matching messages", "pressedmail")}</span>
            </DialogTitleRow>
          </DialogTitle>
        </DialogHeader>

        <div
          data-test="sweep-dialog-body"
          data-testid="sweep-dialog-body"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <SweepStep
            step={1}
            title={__("Sweep scope", "pressedmail")}
            description={scope.viewLabel}>
            <div className="grid gap-2 text-sm">
              <label
                className={cn(
                  "flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2",
                  scopeMode === "entire_view" && "border-primary bg-primary/5",
                )}>
                <input
                  data-test="sweep-scope-entire"
                  data-testid="sweep-scope-entire"
                  type="radio"
                  name="sweep-scope-mode"
                  value="entire_view"
                  checked={scopeMode === "entire_view"}
                  onChange={() => {
                    setScopeMode("entire_view");
                    setError(null);
                  }}
                />
                <span className="min-w-0">
                  <span className="block font-medium">
                    {sprintf(
                      /* translators: %s: folder/view label. */
                      __("Entire %s", "pressedmail"),
                      scope.viewLabel,
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {__(
                      "Criteria apply across the whole folder, active search and filters are ignored.",
                      "pressedmail",
                    )}
                    {excludedCount > 0
                      ? " " +
                        sprintf(
                          /* translators: %d: number of excluded messages. */
                          __("%d unchecked messages stay put.", "pressedmail"),
                          excludedCount,
                        )
                      : ""}
                  </span>
                </span>
              </label>
              <label
                className={cn(
                  "flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2",
                  scopeMode === "selected_only" &&
                    "border-primary bg-primary/5",
                  selectedCount === 0 && "opacity-50",
                )}>
                <input
                  data-test="sweep-scope-selected"
                  data-testid="sweep-scope-selected"
                  type="radio"
                  name="sweep-scope-mode"
                  value="selected_only"
                  disabled={selectedCount === 0}
                  checked={scopeMode === "selected_only"}
                  onChange={() => {
                    setScopeMode("selected_only");
                    setError(null);
                  }}
                />
                <span className="min-w-0">
                  <span className="block font-medium">
                    {sprintf(
                      /* translators: %d: number of selected messages. */
                      __("Selected messages only (%d)", "pressedmail"),
                      selectedCount,
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {__(
                      "Criteria filter within your selection.",
                      "pressedmail",
                    )}
                  </span>
                </span>
              </label>
            </div>
          </SweepStep>

          <Separator />

          <SweepStep
            step={2}
            title={__("Match source", "pressedmail")}
            description={sprintf(
              /* translators: %d: selected message count. */
              __("Derived from %d sample messages", "pressedmail"),
              seed.sampleCount,
            )}>
            <div className="grid gap-2 text-sm">
              {MATCH_TYPES.map((type) => (
                <label
                  key={type}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2",
                    matchType === type && "border-primary bg-primary/5",
                  )}>
                  <span className="flex items-center gap-2">
                    <input
                      aria-label={matchLabel(type)}
                      type="radio"
                      name="sweep-match-type"
                      value={type}
                      checked={matchType === type}
                      onChange={() => {
                        setMatchType(type);
                        setError(null);
                      }}
                    />
                    <span>{matchLabel(type)}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {matchValues[type].length}
                  </span>
                </label>
              ))}
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-3">
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                {__("Matched values", "pressedmail")}
              </div>
              {availableValues.length > 0 ? (
                <div
                  data-test="sweep-match-values-list"
                  data-testid="sweep-match-values-list"
                  className={cn(
                    "space-y-1 text-sm",
                    valuesShouldScroll && "max-h-56 overflow-y-auto pr-2",
                  )}>
                  {availableValues.map((value) => (
                    <label
                      key={value}
                      data-test={`sweep-match-value-row-${value}`}
                      data-testid={`sweep-match-value-row-${value}`}
                      className="flex min-w-0 items-center gap-2 rounded-sm px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={selectedValueSet.has(value)}
                        onChange={(event) =>
                          toggleMatchValue(value, event.currentTarget.checked)
                        }
                      />
                      <span className="min-w-0 truncate text-foreground">
                        {value}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {__(
                    "No usable values found for this match type.",
                    "pressedmail",
                  )}
                </p>
              )}
            </div>

            <div className="grid gap-1 rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              <div>
                {sprintf(
                  /* translators: %s: match type label. */
                  __("Chosen match: %s", "pressedmail"),
                  matchLabel(matchType),
                )}
              </div>
              <div>
                {sprintf(
                  /* translators: %s: selected match values. */
                  __("Values: %s", "pressedmail"),
                  selectedValueSummary || __("None", "pressedmail"),
                )}
              </div>
              <div>
                {__(
                  "Matching count: estimated after queue sync",
                  "pressedmail",
                )}
              </div>
            </div>
          </SweepStep>

          <Separator />

          <SweepStep
            step={3}
            title={__("Destination", "pressedmail")}
            description={__(
              "Matching messages will be moved to this folder.",
              "pressedmail",
            )}>
            <Label className="font-medium">
              {__("Destination folder", "pressedmail")}
            </Label>
            <Select value={folderValue} onValueChange={setFolderValue}>
              <SelectTrigger
                data-test="sweep-folder-select-trigger"
                data-testid="sweep-folder-select-trigger"
                className="h-8 w-full bg-card text-foreground">
                <SelectValue placeholder={__("Choose folder", "pressedmail")} />
              </SelectTrigger>
              <SelectContent
                data-test="sweep-folder-select-content"
                data-testid="sweep-folder-select-content"
                className="border-border bg-popover text-popover-foreground">
                {folderOptions.map((folder) => (
                  <SelectItem
                    key={folder.value}
                    value={folder.value}
                    data-test={`sweep-folder-option-${folder.name}`}
                    data-testid={`sweep-folder-option-${folder.name}`}>
                    {folder.name}
                    {folder.role && folder.role !== "inbox"
                      ? ` (${folder.role})`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentOption?.partialCoverage ? (
              <p className="text-xs text-muted-foreground">
                {__(
                  "This folder is created automatically on accounts that don't have it yet.",
                  "pressedmail",
                )}
              </p>
            ) : null}
          </SweepStep>

          <Separator />

          <SweepStep step={4} title={__("Automation", "pressedmail")}>
            <label className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
              <input
                aria-label={__(
                  "Also create rule for future messages",
                  "pressedmail",
                )}
                type="checkbox"
                checked={createRule}
                onChange={(event) => setCreateRule(event.currentTarget.checked)}
              />
              <span>
                {__("Also create rule for future messages", "pressedmail")}
              </span>
            </label>
          </SweepStep>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="border-t border-border bg-muted/20 px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}>
            {__("Cancel", "pressedmail")}
          </Button>
          <Button
            data-test="sweep-confirm"
            data-testid="sweep-confirm"
            size="sm"
            onClick={handleConfirm}
            disabled={
              seed.tokens.length === 0 ||
              selectedValues.length === 0 ||
              !folderValue
            }>
            {__("Start sweep", "pressedmail")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EmailSweep;
