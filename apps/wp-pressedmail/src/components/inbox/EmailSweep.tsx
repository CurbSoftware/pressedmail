"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { __, _n, sprintf } from "@wordpress/i18n";
import {
  Button,
  cn,
  Checkbox,
  Dialog,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  toast,
} from "@kit/ui/plugin";
import { AlertCircle, Brush } from "lucide-react";
import {
  PressedDialogContent,
  PressedDialogHeader,
  PressedOverlayBody,
  PressedOverlayError,
  PressedOverlayFooter,
  revealInBody,
} from "@/components/ui/pressed-overlay";
import type { EmailMessage } from "@/types";
import type { ImapFolder } from "@/services/interfaces";
import {
  getFolderRole,
  getSweepMoveTargetFolders,
} from "@/lib/bulk-mail-actions";
import {
  getMessageIdentityKey,
  parseAccountQualifiedToken,
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
import {
  captureRequestPrincipal,
  isRequestPrincipalCurrent,
} from "@/lib/principal-storage";
import { folderPathsEqual } from "@/services/filter-rule-folder-targets";
import {
  createFilterRule,
  fetchFilterRules,
  previewFilterRuleRun,
  startFilterRuleRun,
} from "@/services/filter-rules.service";
import type {
  FilterRule,
  FilterRuleRunRef,
  FilterRuleRunRequest,
  SweepRuleActionType,
} from "@/types/filter-rules";
import { ruleCanRunManually } from "@/types/filter-rules";
import { useTagsOptional } from "@/context/tags/TagsContext";
import {
  SweepScoreRange,
  proActionHint,
  proActionLabel,
  proSweepImpact,
  proSweepMatchAllLabel,
  sweepScoreRangeError,
  useProSweepTasks,
} from "@/components/settings/filter-rules/pro-rule-options.active";

/**
 * What a sweep does. Move goes through the activity queue as before; every
 * other task runs through the rule engine, as unsaved rules built from the
 * match (tag, untag, scan) or as the saved rules the user picks.
 */
type SweepTask = "move" | SweepRuleActionType | "run_rules";

function taskLabel(task: SweepTask): string {
  switch (task) {
    case "add_tag":
      return __("Add a tag", "pressedmail");
    case "remove_tag":
      return __("Remove a tag", "pressedmail");
    case "run_rules":
      return __("Run saved rules", "pressedmail");
    case "move":
      return __("Move to a folder", "pressedmail");
    default:
      return proActionLabel(task);
  }
}

/**
 * The scans look at mail instead of changing it. That is why they alone may
 * take every message in the scope: tagging or moving everything is not a sweep.
 */
const SCAN_TASKS: ReadonlySet<SweepTask> = new Set<SweepTask>([
  "run_security_check",
  "run_spam_check",
  "run_phishing_check",
  "run_auto_tagger",
]);

function sweepTasks(scans: SweepTask[]): SweepTask[] {
  // The scans are Pro; Free has no engine behind them and lists none.
  return ["move", "add_tag", "remove_tag", ...scans, "run_rules"];
}

/** What "every message" means to the rule engine: read or not read. Matches the server's own pair. */
const EVERY_MESSAGE_CONDITIONS = [
  { field: "is_read", operator: "is_true", value: "" },
  { field: "is_read", operator: "is_false", value: "" },
] as const;

function messageRefs(tokens: string[]): FilterRuleRunRef[] {
  const refs: FilterRuleRunRef[] = [];
  for (const token of tokens) {
    const parsed = parseAccountQualifiedToken(token);
    if (parsed?.kind === "message") {
      refs.push({
        accountId: parsed.accountId,
        folder: parsed.folder,
        uidValidity: parsed.uidValidity,
        uid: parsed.uid,
      });
    }
  }
  return refs;
}

const EMAIL_RE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/;
const BRACKET_EMAIL_RE = /<([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})>/;
const MAX_VISIBLE_SWEEP_VALUES = 10;
/** A follow-up field under a chosen option: indented on a rule, a little apart from the grid. */
const SUB_FIELD = "mt-3 space-y-1.5 border-l-2 border-primary/40 pl-3";
/**
 * Most values one rule-run sweep (tag, untag, scan) may match;
 * FilterRuleRunService::MAX_SWEEP_VALUES. The move sweep has no cap.
 */
const MAX_SWEEP_VALUES = 50;

/** The server's reason when it gave one, else a plain retry line. */
function sweepStartError(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  return message && !message.startsWith("Failed to start rule run")
    ? message
    : __("Couldn't start the sweep. Try again.", "pressedmail");
}

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

function matchLabel(type: SweepMatchType | "all"): string {
  if (type === "all") return proSweepMatchAllLabel();
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

/** A sender, domain or subject to look for, or "all": every message in the scope (scans only). */
type SweepMatch = SweepMatchType | "all";

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
    // No numbered badges: five of them read like a wizard crammed into one
    // scroll, and they renumbered as tasks hid a step.
    <section className="space-y-3" data-test={`sweep-step-${step}`}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="mt-1 text-[12px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

interface SweepSeed {
  tokens: string[];
  complete: boolean;
  sampleCount: number;
  matchValues: SelectedValuesByType;
}

function deriveSeed(messages: EmailMessage[]): SweepSeed {
  const tokens = new Set(messages.map(getMessageIdentityKey));
  const complete = !tokens.has("");
  tokens.delete("");
  const senders = messages.map(messageSender);
  return {
    tokens: Array.from(tokens),
    complete,
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
  scope: liveScope,
  folders: liveFolders,
  onRun,
  selection: liveSelection,
}: EmailSweepProps) {
  // Freeze everything derived from the selected rows at OPEN time: the list
  // refreshes underneath the dialog (sync poll, the sweep's own live refresh)
  // and re-derived values used to silently reset the user's choices mid-edit.
  const [seed, setSeed] = useState<SweepSeed>(() =>
    deriveSeed(initialMessages),
  );
  const wasOpenRef = useRef(false);
  const submittedRef = useRef(false);
  // Bumped on every open, so a start request from an earlier open never
  // closes or writes an error into the dialog the user has open now.
  const openGenerationRef = useRef(0);
  const [snapshot, setSnapshot] = useState(() =>
    structuredClone({
      scope: liveScope,
      folders: liveFolders,
      selection: liveSelection,
    }),
  );
  const { scope, folders, selection } = snapshot;

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
          // Junk and Trash are ROLE destinations: the server resolves them to
          // whichever folder actually carries the role, so naming them after
          // the first folder that happened to match gave the same destination a
          // different label here than everywhere else. A mailbox carrying both
          // `Junk` and `INBOX.spam` listed "INBOX / spam" in this dialog while
          // the toolbar, the move menu and the fallbacks below all said "Junk".
          // One destination, one name, and the duplicate collapses on the
          // shared destination key.
          name: isJunk
            ? __("Junk", "pressedmail")
            : isTrash
              ? __("Trash", "pressedmail")
              : (flattened.find((entry) => entry.folder === folder)
                  ?.breadcrumb ?? folder.name),
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
  const [matchType, setMatchType] = useState<SweepMatch>("sender_email");
  const [selectedValuesByType, setSelectedValuesByType] =
    useState<SelectedValuesByType>(seed.matchValues);
  const [folderValue, setFolderValue] = useState("");
  const [createRule, setCreateRule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<SweepTask>("move");
  const [tagId, setTagId] = useState("");
  const [onlyTagId, setOnlyTagId] = useState("");
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [spamMin, setSpamMin] = useState("");
  const [spamMax, setSpamMax] = useState("");
  const [spamBand, setSpamBand] = useState("");
  const [savedRules, setSavedRules] = useState<FilterRule[]>([]);
  const [savedRulesFailed, setSavedRulesFailed] = useState(false);
  const [savedRulesReload, setSavedRulesReload] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [ruleIds, setRuleIds] = useState<string[]>([]);
  const tags = useTagsOptional()?.tags ?? [];
  const scanTasks = useProSweepTasks();
  const usesTag = task === "add_tag" || task === "remove_tag";
  const isScan = SCAN_TASKS.has(task);
  const matchAll = matchType === "all";
  // A range matches only mail already checked, and a check skips mail it has
  // already checked, so a check cannot use the range of its own kind: it would
  // find nothing. It can use the other's.
  const rangeTask = task !== "move" && task !== "run_rules";
  const usesScoreRange =
    __ENABLE_PHISHING_DETECTION__ &&
    rangeTask &&
    task !== "run_phishing_check" &&
    task !== "run_security_check";
  const usesSpamRange =
    __ENABLE_SPAM_DETECTION__ &&
    rangeTask &&
    task !== "run_spam_check" &&
    task !== "run_security_check";
  const scoreRangeError = usesScoreRange
    ? sweepScoreRangeError(scoreMin, scoreMax)
    : null;
  // The reason comes from the Pro module, so the Free bundle names no spam.
  const spamRangeError = usesSpamRange
    ? sweepScoreRangeError(spamMin, spamMax)
    : null;

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    // One reset per OPEN, never mid-edit.
    submittedRef.current = false;
    openGenerationRef.current += 1;
    setSnapshot(
      structuredClone({
        scope: liveScope,
        folders: liveFolders,
        selection: liveSelection,
      }),
    );
    const nextSeed = deriveSeed(initialMessages);
    setSeed(nextSeed);
    setScopeMode(
      (liveSelection?.selectedCount ?? nextSeed.sampleCount) > 0
        ? "selected_only"
        : "entire_view",
    );
    setMatchType("sender_email");
    setSelectedValuesByType(nextSeed.matchValues);
    setCreateRule(false);
    setError(null);
    setFolderValue("");
    setTask("move");
    setTagId("");
    setOnlyTagId("");
    setScoreMin("");
    setScoreMax("");
    setSpamMin("");
    setSpamMax("");
    setSpamBand("");
    setRuleIds([]);
    setSubmitting(false);
  }, [open, initialMessages, liveScope, liveFolders, liveSelection]);

  // Saved rules for "Run saved rules": the view's accounts plus all-account rules.
  useEffect(() => {
    if (!open || task !== "run_rules") return;
    let cancelled = false;
    const accountIds = [
      0,
      ...new Set(snapshot.scope.accountIds.filter((id) => id > 0)),
    ];
    setSavedRulesFailed(false);
    // A failed load is not "no rules": say so and offer a retry.
    void Promise.all(accountIds.map((id) => fetchFilterRules(id))).then(
      (lists) => {
        if (cancelled) return;
        const byId = new Map<string, FilterRule>();
        for (const rule of lists.flat()) {
          if (rule.enabled && ruleCanRunManually(rule)) byId.set(rule.id, rule);
        }
        setSavedRules([...byId.values()]);
      },
      () => {
        if (!cancelled) setSavedRulesFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, task, snapshot.scope.accountIds, savedRulesReload]);

  // Keep the destination valid without clobbering an explicit choice. It is
  // never filled in for the user: a move needs a folder they picked.
  useEffect(() => {
    if (!open) return;
    if (
      folderValue !== "" &&
      !folderOptions.some((option) => option.value === folderValue)
    ) {
      setFolderValue("");
    }
  }, [open, folderOptions, folderValue]);

  const matchValues = seed.matchValues;
  const availableValues = useMemo(
    () => (matchType === "all" ? [] : matchValues[matchType]),
    [matchType, matchValues],
  );
  const selectedValues = useMemo(
    () =>
      matchType === "all"
        ? []
        : selectedValuesByType[matchType].filter((value) =>
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
      if (matchType === "all") return;
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

  const setAllMatchValues = useCallback(
    (checked: boolean) => {
      if (matchType === "all") return;
      setSelectedValuesByType((current) => ({
        ...current,
        [matchType]: checked ? [...availableValues] : [],
      }));
      setError(null);
    },
    [availableValues, matchType],
  );

  /** The rule run a non-move task starts; the preview asks about the same one. */
  const buildRuleRequest = useCallback((): FilterRuleRunRequest => {
    const accountIds = [...new Set(scope.accountIds.filter((id) => id > 0))];
    const request: FilterRuleRunRequest = {
      ruleIds: task === "run_rules" ? ruleIds : [],
      scope:
        scopeMode === "selected_only"
          ? {
              mode: "selection",
              accountId: accountIds.length === 1 ? (accountIds[0] ?? 0) : 0,
              folder: String(scope.folderPath ?? "INBOX"),
              refs: messageRefs(seed.tokens),
            }
          : {
              mode: "view",
              accountId: accountIds.length === 1 ? (accountIds[0] ?? 0) : 0,
              accountIds: accountIds.length > 1 ? accountIds : [],
              folder: String(scope.folderPath ?? "INBOX"),
              folderMap: scope.folderMap ?? {},
              filters: onlyTagId ? { tags: [Number(onlyTagId)] } : {},
              syncFirst: true,
              excludeRefs: messageRefs(selection?.excludedIds ?? []),
            },
    };
    if (task !== "run_rules" && task !== "move") {
      request.sweep = {
        match: { type: matchType, values: matchAll ? [] : selectedValues },
        actions: [{ type: task, ...(usesTag ? { value: tagId } : {}) }],
        ...(usesScoreRange && scoreMin !== "" ? { scoreMin: Number(scoreMin) } : {}),
        ...(usesScoreRange && scoreMax !== "" ? { scoreMax: Number(scoreMax) } : {}),
        ...(usesSpamRange && spamMin !== "" ? { spamMin: Number(spamMin) } : {}),
        ...(usesSpamRange && spamMax !== "" ? { spamMax: Number(spamMax) } : {}),
        ...(usesSpamRange && spamBand !== "" ? { spamBand } : {}),
      };
    }
    return request;
  }, [matchAll, matchType, onlyTagId, ruleIds, scope, scopeMode, scoreMax, scoreMin, seed.tokens, selectedValues, selection, spamBand, spamMax, spamMin, tagId, task, usesScoreRange, usesSpamRange, usesTag]);

  /** Tag, untag, scan or run saved rules: a rule run over the same scope. */
  const runThroughRules = useCallback(
    async (
      principal: NonNullable<ReturnType<typeof captureRequestPrincipal>>,
    ) => {
      if (task === "run_rules" && ruleIds.length === 0) {
        setError(__("Choose at least one rule", "pressedmail"));
        return;
      }
      if (task !== "run_rules" && !matchAll && selectedValues.length === 0) {
        setError(__("Choose at least one match value", "pressedmail"));
        return;
      }
      if (usesTag && tagId === "") {
        setError(__("Choose a tag", "pressedmail"));
        return;
      }
      if (scoreRangeError || spamRangeError) {
        setError(scoreRangeError || spamRangeError);
        return;
      }
      const selectionRefs = messageRefs(seed.tokens);
      if (scopeMode === "selected_only" && selectionRefs.length === 0) {
        // Rows from an older mailbox load carry no message identity.
        setError(
          __(
            "Some selected messages need refreshing. Reload the mailbox before running Sweep.",
            "pressedmail",
          ),
        );
        return;
      }
      const accountIds = [...new Set(scope.accountIds.filter((id) => id > 0))];
      const request = buildRuleRequest();
      // Stay open until the server answers: a refused sweep keeps every choice
      // on screen with the reason, instead of a toast over a closed dialog.
      submittedRef.current = true;
      setSubmitting(true);
      setError(null);
      const generation = openGenerationRef.current;
      try {
        await startFilterRuleRun(structuredClone(request));
      } catch (err) {
        if (!isRequestPrincipalCurrent(principal)) return;
        if (generation !== openGenerationRef.current) {
          // The dialog this came from is gone: say so without touching the new one.
          toast.error(sweepStartError(err));
          return;
        }
        submittedRef.current = false;
        setSubmitting(false);
        setError(sweepStartError(err));
        return;
      }
      if (generation === openGenerationRef.current) {
        setSubmitting(false);
        onOpenChange(false);
      }
      try {
        if (!isRequestPrincipalCurrent(principal)) return;
        toast.success(
          __("Sweep started. Rule activity shows its progress.", "pressedmail"),
        );
        if (createRule && (usesTag || isScan)) {
          const created = await createFilterRule({
            name: sprintf(
              /* translators: %s: sweep match values, or the check a sweep runs on every message. */
              __("Sweep: %s", "pressedmail"),
              matchAll ? taskLabel(task) : selectedValues.slice(0, 3).join(", "),
            ),
            accountId: accountIds.length === 1 ? (accountIds[0] ?? 0) : 0,
            conditionLogic: "or",
            conditions: matchAll
              ? [...EVERY_MESSAGE_CONDITIONS]
              : selectedValues.map((value) =>
                  matchType === "subject_contains"
                    ? { field: "subject", operator: "contains", value }
                    : matchType === "sender_domain"
                      ? {
                          field: "from",
                          operator: "ends_with",
                          value: `@${value.replace(/^@/, "")}`,
                        }
                      : { field: "from", operator: "equals", value },
                ),
            actions: [
              usesTag
                ? { type: task as "add_tag" | "remove_tag", value: tagId }
                : { type: task as SweepRuleActionType },
            ],
            runTriggers: ["manual", "on_receive"],
          });
          if (created.success) {
            window.dispatchEvent(new CustomEvent("pm-filter-rules-changed"));
          } else if (created.error) {
            toast.warning(
              sprintf(
                /* translators: %s: rules-layer error message. */
                __(
                  "Sweep started, but the rule for future messages could not be created: %s",
                  "pressedmail",
                ),
                created.error,
              ),
            );
          }
        }
      } catch (err) {
        if (!isRequestPrincipalCurrent(principal)) return;
        toast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [
      buildRuleRequest,
      createRule,
      isScan,
      matchAll,
      matchType,
      onOpenChange,
      ruleIds,
      scope,
      scopeMode,
      scoreRangeError,
      spamRangeError,
      seed.tokens,
      selectedValues,
      tagId,
      task,
      usesTag,
    ],
  );

  const handleConfirm = useCallback(() => {
    if (submittedRef.current) return;
    const principal = captureRequestPrincipal();
    if (!principal || !isRequestPrincipalCurrent(principal)) {
      setError(
        __("Your session changed. Reload before running Sweep.", "pressedmail"),
      );
      return;
    }
    if (
      !seed.complete ||
      (scopeMode === "entire_view" &&
        selection?.excludedIds?.some(
          (token) => parseAccountQualifiedToken(token)?.kind !== "message",
        ))
    ) {
      setError(
        __(
          "Some selected messages need refreshing. Reload the mailbox before running Sweep.",
          "pressedmail",
        ),
      );
      return;
    }
    if (seed.tokens.length === 0) {
      setError(__("Select at least one sample message", "pressedmail"));
      return;
    }
    if (task !== "move") {
      void runThroughRules(principal);
      return;
    }
    // Only a scan may take everything in the scope; a move never does.
    if (matchType === "all" || selectedValues.length === 0) {
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

    // Stay open until the queue accepts it, the same as every other task:
    // a refusal keeps every choice on screen with the reason.
    submittedRef.current = true;
    setSubmitting(true);
    setError(null);
    const generation = openGenerationRef.current;
    void (async () => {
      let result: unknown;
      try {
        result = await onRun(structuredClone(request));
      } catch (err) {
        if (!isRequestPrincipalCurrent(principal)) return;
        if (generation !== openGenerationRef.current) {
          toast.error(sweepStartError(err));
          return;
        }
        submittedRef.current = false;
        setSubmitting(false);
        setError(sweepStartError(err));
        return;
      }
      if (generation === openGenerationRef.current) {
        setSubmitting(false);
        onOpenChange(false);
      }
      if (!isRequestPrincipalCurrent(principal)) return;
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
    })();
  }, [
    createRule,
    folderValue,
    folderOptions,
    matchType,
    onOpenChange,
    onRun,
    runThroughRules,
    scope,
    scopeMode,
    seed,
    selectedValues,
    selection,
    task,
  ]);

  const valuesShouldScroll = availableValues.length > MAX_VISIBLE_SWEEP_VALUES;
  const selectedCount = selection?.selectedCount ?? seed.sampleCount;
  const excludedCount =
    scopeMode === "entire_view" ? (selection?.excludedIds?.length ?? 0) : 0;
  const currentOption = folderOptions.find(
    (option) => option.value === folderValue,
  );
  // Steps are numbered as they show, so no task skips a number.
  let stepNumber = 0;
  const nextStep = () => ++stepNumber;
  // Why Start sweep is off, said next to it.
  const startBlocker =
    seed.tokens.length === 0
      ? __("Select at least one message first.", "pressedmail")
      : task === "run_rules" && savedRulesFailed
        ? __("Your rules didn't load. Try again above.", "pressedmail")
        : task === "run_rules" && ruleIds.length === 0
        ? __("Choose at least one rule.", "pressedmail")
        : task !== "run_rules" && !matchAll && selectedValues.length === 0
          ? __("Choose at least one value to match.", "pressedmail")
          : task !== "run_rules" &&
              task !== "move" &&
              !matchAll &&
              selectedValues.length > MAX_SWEEP_VALUES
            ? sprintf(
                /* translators: 1: most values a sweep can match, 2: values ticked now. */
                __(
                  "Untick some values. A sweep matches up to %1$d, and %2$d are ticked.",
                  "pressedmail",
                ),
                MAX_SWEEP_VALUES,
                selectedValues.length,
              )
            : task === "move" && !folderValue
              ? __("Choose a destination folder.", "pressedmail")
              : usesTag && tagId === ""
                ? __("Choose a tag.", "pressedmail")
                : scoreRangeError
                  ? // The reason itself shows under the field.
                    __("Fix the phishing risk range.", "pressedmail")
                  : spamRangeError;
  // How much a rule-run task takes on, before it starts: the server counts
  // the messages in scope the same way the run will.
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const previewKey =
    open && task !== "move" && startBlocker === null
      ? JSON.stringify(buildRuleRequest())
      : "";
  useEffect(() => {
    setPreviewCount(null);
    if (previewKey === "") return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void previewFilterRuleRun(JSON.parse(previewKey) as FilterRuleRunRequest).then(
        (preview) => {
          if (!cancelled) setPreviewCount(preview.candidateCount);
        },
        () => undefined,
      );
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [previewKey]);
  // The AI scans carry their own credit copy, which only Pro ships.
  const impact =
    previewCount === null
      ? null
      : (proSweepImpact(task, previewCount) ??
        sprintf(
          /* translators: %d: messages the sweep checks. */
          _n("Checks about %d message.", "Checks about %d messages.", previewCount, "pressedmail"),
          previewCount,
        ));

  // Start is off and the reason may be off screen: take the user to it.
  const blockerField =
    seed.tokens.length === 0
      ? null
      : task === "run_rules"
        ? '[data-sweep-field="rules"]'
        : !matchAll &&
            (selectedValues.length === 0 ||
              selectedValues.length > MAX_SWEEP_VALUES)
          ? '[data-sweep-field="values"]'
          : task === "move" && !folderValue
            ? "#sweep-folder-select"
            : usesTag && tagId === ""
              ? "#sweep-tag-select"
              : scoreRangeError
                ? '[data-sweep-field="score"]'
                : spamRangeError
                  ? '[data-sweep-field="spam-score"]'
                  : null;
  const revealBlocker = () => {
    if (!blockerField) return;
    const target = document.querySelector<HTMLElement>(
      `[data-testid="sweep-dialog-body"] ${blockerField}`,
    );
    if (!target) return;
    revealInBody(target);
    const focusable = target.matches("button, input")
      ? target
      : target.querySelector<HTMLElement>("button, input");
    focusable?.focus({ preventScroll: true });
  };

  const tagDot = (color?: string) => (
    <span
      aria-hidden="true"
      className="mr-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-border align-middle"
      style={{ backgroundColor: color || "transparent" }}
    />
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape, the close button and outside clicks wait for the server, so
        // a refusal is never dropped behind a closed dialog.
        if (!next && submitting) return;
        onOpenChange(next);
      }}>
      <PressedDialogContent
        size="compactForm"
        aria-describedby={undefined}
        data-test="sweep-dialog-content"
        data-testid="sweep-dialog-content"
        // A fixed height from sm up: sized to its content, the dialog moved
        // up and down as tasks added or dropped a step.
        className="flex max-h-[85vh] flex-col overflow-hidden border-border bg-card text-card-foreground sm:h-[min(85vh,46rem)]">
        <PressedDialogHeader
          title={__("Sweep matching messages", "pressedmail")}
          icon={Brush}
        />

        <PressedOverlayBody
          data-test="sweep-dialog-body"
          data-testid="sweep-dialog-body"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <SweepStep step={nextStep()} title={__("Sweep scope", "pressedmail")}>
            <div className="grid gap-2 text-sm">
              <label
                className={cn(
                  "flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2 max-sm:min-h-11 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--pm-focus-ring)]",
                  scopeMode === "entire_view" && "border-primary bg-primary/5",
                )}>
                <span className="flex h-5 shrink-0 items-center">
                  <input
                    className="m-0"
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
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">
                    {__("The whole folder", "pressedmail")}
                  </span>
                  <span className="block text-[12px] text-muted-foreground">
                    {sprintf(
                      /* translators: %s: folder/view label, such as "you@example.com Inbox". */
                      __("%s. Search and filters are ignored.", "pressedmail"),
                      scope.viewLabel,
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
                  "flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2 max-sm:min-h-11 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--pm-focus-ring)]",
                  scopeMode === "selected_only" &&
                    "border-primary bg-primary/5",
                  selectedCount === 0 && "opacity-50",
                )}>
                <span className="flex h-5 shrink-0 items-center">
                  <input
                    className="m-0"
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
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">
                    {sprintf(
                      /* translators: %d: number of selected messages. */
                      __("Selected messages only (%d)", "pressedmail"),
                      selectedCount,
                    )}
                  </span>
                  <span className="block text-[12px] text-muted-foreground">
                    {__("Only checks the messages you picked.", "pressedmail")}
                  </span>
                </span>
              </label>
            </div>
          </SweepStep>

          <Separator />

          <SweepStep step={nextStep()} title={__("What to do", "pressedmail")}>
            <div
              className="grid gap-2 text-sm sm:grid-cols-2"
              role="radiogroup"
              aria-label={__("What to do", "pressedmail")}>
              {sweepTasks(scanTasks).map((option) => (
                <label
                  key={option}
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 max-sm:min-h-11 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--pm-focus-ring)]",
                    task === option && "border-primary bg-primary/5",
                  )}>
                  <input
                    className="m-0 shrink-0"
                    type="radio"
                    name="sweep-task"
                    value={option}
                    data-test={`sweep-action-${option}`}
                    data-testid={`sweep-action-${option}`}
                    checked={task === option}
                    onChange={() => {
                      setTask(option);
                      // A scan starts on everything in the scope; the other
                      // tasks start on a sender. Moving between the two kinds
                      // never carries the other's choice over.
                      setMatchType((current) =>
                        SCAN_TASKS.has(option)
                          ? SCAN_TASKS.has(task)
                            ? current
                            : "all"
                          : current === "all"
                            ? "sender_email"
                            : current,
                      );
                      // A tag picked for Add a tag never arrives pre-armed in
                      // Remove a tag, and the same for a destination.
                      setTagId("");
                      setFolderValue("");
                      setError(null);
                    }}
                  />
                  <span>{taskLabel(option)}</span>
                </label>
              ))}
            </div>

            {task === "move" ? (
              // Right under the choice, the same place Add a tag puts its tag,
              // indented on a rule so it reads as part of the chosen option.
              <div className={SUB_FIELD}>
                <Label htmlFor="sweep-folder-select" className="font-medium">
                  {__("Move to", "pressedmail")}
                </Label>
                <Select value={folderValue} onValueChange={setFolderValue}>
                  <SelectTrigger
                    id="sweep-folder-select"
                    data-test="sweep-folder-select-trigger"
                    data-testid="sweep-folder-select-trigger"
                    className="w-full bg-card text-foreground">
                    <SelectValue
                      placeholder={__("Choose folder", "pressedmail")}
                    />
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
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentOption?.partialCoverage ? (
                  <p className="text-[12px] text-muted-foreground">
                    {__(
                      "This folder is created automatically on accounts that don't have it yet.",
                      "pressedmail",
                    )}
                  </p>
                ) : null}
              </div>
            ) : null}

            {usesTag ? (
              <div className={SUB_FIELD}>
                <Label htmlFor="sweep-tag-select" className="font-medium">
                  {__("Tag", "pressedmail")}
                </Label>
                <Select value={tagId} onValueChange={setTagId}>
                  <SelectTrigger
                    id="sweep-tag-select"
                    data-test="sweep-tag-select"
                    data-testid="sweep-tag-select"
                    className="w-full bg-card text-foreground">
                    <SelectValue
                      placeholder={
                        tags.length > 0
                          ? __("Choose a tag", "pressedmail")
                          : __("No tags yet", "pressedmail")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={String(tag.id)}>
                        {tagDot(tag.color)}
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {proActionHint(task) ? (
              <p className="text-[12px] text-muted-foreground">
                {proActionHint(task)}
              </p>
            ) : null}

            {task === "run_rules" ? (
              <fieldset
                className={cn(SUB_FIELD, "grid gap-2 text-sm")}
                data-sweep-field="rules"
                data-test="sweep-rules-list"
                data-testid="sweep-rules-list">
                <legend className="mb-1.5 text-sm font-medium">
                  {__("Rules to run", "pressedmail")}
                </legend>
                {savedRulesFailed ? (
                  <div
                    role="alert"
                    className="flex flex-wrap items-center gap-2 text-sm text-destructive"
                    data-test="sweep-rules-error"
                    data-testid="sweep-rules-error">
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {__("Couldn't load your rules.", "pressedmail")}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSavedRulesReload((token) => token + 1)}>
                      {__("Try again", "pressedmail")}
                    </Button>
                  </div>
                ) : savedRules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {__("No rules you can run by hand.", "pressedmail")}
                  </p>
                ) : (
                  savedRules.map((rule) => (
                    <label
                      key={rule.id}
                      className={cn(
                        "flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-3 py-2",
                        ruleIds.includes(rule.id) &&
                          "border-primary bg-primary/5",
                      )}>
                      <Checkbox
                        data-test={`sweep-rule-option-${rule.id}`}
                        data-testid={`sweep-rule-option-${rule.id}`}
                        checked={ruleIds.includes(rule.id)}
                        onCheckedChange={(checked) =>
                          setRuleIds((current) =>
                            checked
                              ? [...new Set([...current, rule.id])]
                              : current.filter((id) => id !== rule.id),
                          )
                        }
                        aria-label={rule.name}
                      />
                      <span className="min-w-0 truncate">{rule.name}</span>
                    </label>
                  ))
                )}
              </fieldset>
            ) : null}
          </SweepStep>

          {/* Only between steps: a rule under the last one led nowhere. */}
          {task !== "run_rules" || scopeMode === "entire_view" ? <Separator /> : null}

          {task !== "run_rules" ? (
            <>
              <SweepStep
                step={nextStep()}
                title={__("Match messages by", "pressedmail")}
                description={
                  matchAll
                    ? undefined
                    : sprintf(
                        /* translators: %d: selected message count. */
                        _n(
                          "The values come from the %d message you selected.",
                          "The values come from the %d messages you selected.",
                          seed.sampleCount,
                          "pressedmail",
                        ),
                        seed.sampleCount,
                      )
                }>
                <div className="grid gap-2 text-sm">
                  {(isScan
                    ? (["all", ...MATCH_TYPES] as SweepMatch[])
                    : (MATCH_TYPES as SweepMatch[])
                  ).map((type) => (
                    <label
                      key={type}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 max-sm:min-h-11 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--pm-focus-ring)]",
                        matchType === type && "border-primary bg-primary/5",
                      )}>
                      <span className="flex items-center gap-2">
                        <input
                          className="m-0 shrink-0"
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
                      {type === "all" ? null : (
                        <span className="text-[12px] text-muted-foreground">
                          {sprintf(
                            /* translators: %d: how many values this match type found. */
                            _n(
                              "%d value",
                              "%d values",
                              matchValues[type].length,
                              "pressedmail",
                            ),
                            matchValues[type].length,
                          )}
                        </span>
                      )}
                    </label>
                  ))}
                </div>

                {matchAll ? null : (
                  <div
                    className="rounded-md border border-border bg-muted/20 p-3"
                    data-sweep-field="values">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="text-sm font-medium text-foreground">
                        {__("Values to match", "pressedmail")}
                      </span>
                      {availableValues.length > 0 ? (
                        <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
                          <span data-test="sweep-match-values-count" data-testid="sweep-match-values-count">
                            {sprintf(
                              /* translators: 1: values ticked, 2: values found. */
                              __("%1$d of %2$d ticked", "pressedmail"),
                              selectedValues.length,
                              availableValues.length,
                            )}
                          </span>
                          <button
                            type="button"
                            className="rounded-sm font-medium text-foreground underline underline-offset-2 hover:no-underline max-sm:min-h-11"
                            data-test="sweep-match-values-all"
                            data-testid="sweep-match-values-all"
                            onClick={() => setAllMatchValues(true)}>
                            {__("All", "pressedmail")}
                          </button>
                          <button
                            type="button"
                            className="rounded-sm font-medium text-foreground underline underline-offset-2 hover:no-underline max-sm:min-h-11"
                            data-test="sweep-match-values-none"
                            data-testid="sweep-match-values-none"
                            onClick={() => setAllMatchValues(false)}>
                            {__("None", "pressedmail")}
                          </button>
                        </span>
                      ) : null}
                    </div>
                    {availableValues.length > 0 ? (
                      <div className="relative">
                        <div
                          data-test="sweep-match-values-list"
                          data-testid="sweep-match-values-list"
                          className={cn(
                            "space-y-1 text-sm",
                            valuesShouldScroll && "max-h-56 overflow-y-scroll pr-2 pb-4",
                          )}>
                          {availableValues.map((value) => (
                            <label
                              key={value}
                              data-test={`sweep-match-value-row-${value}`}
                              data-testid={`sweep-match-value-row-${value}`}
                              className="flex min-w-0 items-center gap-2 rounded-sm px-1 py-0.5 max-sm:min-h-11">
                              <Checkbox
                                checked={selectedValueSet.has(value)}
                                onCheckedChange={(checked) =>
                                  toggleMatchValue(value, Boolean(checked))
                                }
                                aria-label={value}
                              />
                              <span className="min-w-0 truncate text-foreground">
                                {value}
                              </span>
                            </label>
                          ))}
                        </div>
                        {valuesShouldScroll ? (
                          // A fade says the list goes on below the fold.
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-muted/60 to-transparent"
                          />
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {__(
                          "No usable values found for this match type.",
                          "pressedmail",
                        )}
                      </p>
                    )}
                    {valuesShouldScroll ? (
                      <p className="mt-2 text-[12px] text-muted-foreground">
                        {__("Scroll the list to see every value.", "pressedmail")}
                      </p>
                    ) : null}
                  </div>
                )}

                {task === "move" ? (
                  <p className="text-[12px] text-muted-foreground">
                    {__(
                      "We count the matches when the sweep starts.",
                      "pressedmail",
                    )}
                  </p>
                ) : null}
              </SweepStep>

              <Separator />
            </>
          ) : null}
          {task !== "move" && scopeMode === "entire_view" ? (
            <>
              <SweepStep
                step={nextStep()}
                title={__("Narrow it down (optional)", "pressedmail")}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sweep-filter-tag" className="font-medium">
                      {__("Only messages tagged", "pressedmail")}
                    </Label>
                    <Select
                      value={onlyTagId === "" ? "any" : onlyTagId}
                      onValueChange={(value) =>
                        setOnlyTagId(value === "any" ? "" : value)
                      }>
                      <SelectTrigger
                        id="sweep-filter-tag"
                        data-test="sweep-filter-tag"
                        data-testid="sweep-filter-tag"
                        className="w-full bg-card text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">
                          {__("Any tag or none", "pressedmail")}
                        </SelectItem>
                        {tags.map((tag) => (
                          <SelectItem key={tag.id} value={String(tag.id)}>
                            {tagDot(tag.color)}
                            {tag.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {usesScoreRange ? (
                    <SweepScoreRange
                      min={scoreMin}
                      max={scoreMax}
                      onMinChange={setScoreMin}
                      onMaxChange={setScoreMax}
                    />
                  ) : null}
                  {usesSpamRange ? (
                    <SweepScoreRange
                      field="spam"
                      min={spamMin}
                      max={spamMax}
                      onMinChange={setSpamMin}
                      onMaxChange={setSpamMax}
                      band={spamBand}
                      onBandChange={setSpamBand}
                    />
                  ) : null}
                </div>
              </SweepStep>

              <Separator />
            </>
          ) : null}

          {task === "move" || usesTag || isScan ? (
            <SweepStep
              step={nextStep()}
              title={__("Automation", "pressedmail")}>
              <label className="flex items-center gap-2 text-sm max-sm:min-h-11">
                <Checkbox
                  aria-label={__(
                    "Also create a rule for future messages",
                    "pressedmail",
                  )}
                  checked={createRule}
                  onCheckedChange={(checked) => setCreateRule(Boolean(checked))}
                />
                <span>
                  {__("Also create a rule for future messages", "pressedmail")}
                </span>
              </label>
            </SweepStep>
          ) : null}
        </PressedOverlayBody>

        <PressedOverlayFooter className="flex-row flex-wrap items-center">
          <Button
            variant="outline"
            className="flex-1 sm:h-9 sm:flex-none max-sm:min-h-11"
            disabled={submitting}
            onClick={() => onOpenChange(false)}>
            {__("Cancel", "pressedmail")}
          </Button>
          <Button
            data-test="sweep-confirm"
            data-testid="sweep-confirm"
            className="flex-1 sm:h-9 sm:flex-none max-sm:min-h-11"
            onClick={handleConfirm}
            disabled={startBlocker !== null || submitting}>
            {submitting
              ? __("Starting...", "pressedmail")
              : __("Start sweep", "pressedmail")}
          </Button>
          {error ? (
            // In the footer, next to Start, so a refusal is seen without scrolling.
            <PressedOverlayError
              className="flex items-start gap-1.5 order-first basis-full sm:basis-auto sm:mr-auto"
              data-test="sweep-start-error"
              data-testid="sweep-start-error">
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{error}</span>
            </PressedOverlayError>
          ) : startBlocker ? (
            <p
              className="text-sm text-muted-foreground order-first basis-full sm:basis-auto sm:mr-auto"
              data-test="sweep-start-blocker"
              data-testid="sweep-start-blocker">
              {startBlocker}
              {blockerField ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
                    data-test="sweep-start-blocker-show"
                    data-testid="sweep-start-blocker-show"
                    onClick={revealBlocker}>
                    {__("Show me", "pressedmail")}
                  </button>
                </>
              ) : null}
            </p>
          ) : impact ? (
            <p
              className="text-sm text-muted-foreground order-first basis-full sm:basis-auto sm:mr-auto"
              role="status"
              data-test="sweep-impact"
              data-testid="sweep-impact">
              {impact}
            </p>
          ) : null}
        </PressedOverlayFooter>
      </PressedDialogContent>
    </Dialog>
  );
}

export default EmailSweep;
