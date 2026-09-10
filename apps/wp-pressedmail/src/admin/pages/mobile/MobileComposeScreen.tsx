"use client";

import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, Save } from "lucide-react";
import { __ } from "@wordpress/i18n";

import { ComposerContent } from "@/components/inbox/compose/ComposerContent";
import { EmailSendIcon } from "@/components/icons/MailActionIcons";
import type { EmailEditorRef } from "@/components/composer";
import {
  MobileScreen,
  MobileScreenHeader,
  useHideTabBar,
  useOptionalMobileLayout,
} from "@/components/mobile-shell";
import { useAppContext } from "@/context/AppProvider";
import { DEFAULT_COMPOSE_DATA, useComposer } from "@/context/composer";
import { useOptionalScheduledEmails } from "@/context/scheduled/ScheduledEmailsContext";
import { useFeatureAvailable } from "@/context/features/FeaturesContext";
import {
  useFolderOperations,
  useInboxState,
  useMessageOperations,
} from "@/context/InboxContext";
import { useOptionalBackStack } from "@/hooks/useBackStack";
import { useComposeForm } from "@/hooks/compose/v2/useComposeForm";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import {
  consumeComposeRouteSearch,
  parseComposeRouteFields,
} from "@/lib/mailto";
import { cn } from "@/lib/utils";
import { savePaneMode } from "@/lib/open-pane-persistence";
import { parseEmailString } from "@/types/recipients";
import { ComposerReadReceiptButton } from "@/components/inbox/compose/ComposerScheduleActions.active";
import { MobileScheduleActions } from "@/admin/pages/mobile/MobileScheduleActions.active";

function consumeIncomingPayload() {
  const url = new URL(window.location.href);
  const shareKeys = [
    "pm_share_target",
    "pm_share_title",
    "pm_share_text",
    "pm_share_url",
  ];
  for (const key of ["pm_mailto", ...shareKeys]) url.searchParams.delete(key);
  const queryIndex = url.hash.indexOf("?");
  const path = queryIndex < 0 ? url.hash : url.hash.slice(0, queryIndex);
  url.hash = `${path}${consumeComposeRouteSearch(queryIndex < 0 ? "" : url.hash.slice(queryIndex + 1))}`;
  window.history.replaceState(window.history.state, "", url);
}

/**
 * Routed full-screen mobile compose surface. The shell owns navigation and the
 * shared composer owns addressing, toolbar, rich text, attachments, drafts,
 * templates, signatures, and send behavior.
 */
interface MobileComposeScreenProps {
  onClose?: () => void;
  initialFields?: {
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    body?: string;
  };
}

export function MobileComposeScreen({
  onClose,
  initialFields,
}: MobileComposeScreenProps = {}) {
  useHideTabBar(true);
  const ctxBack = useOptionalBackStack();
  const layout = useOptionalMobileLayout();
  const location = useLocation();
  const navigate = useNavigate();
  // Falls back to plain history when rendered outside the phone-shell
  // BackStackProvider (desktop/tablet-wide viewport or pre-mount resize).
  const back = React.useMemo(
    () => ({ pop: ctxBack ? ctxBack.pop : () => navigate(-1) }),
    [ctxBack, navigate],
  );
  const editorRef = React.useRef<EmailEditorRef>(null);
  const composerCtx = useComposer();
  const pendingIncoming = React.useRef(false);
  const handledIncoming = React.useRef<typeof location | null>(null);
  const { archiveMessage } = useMessageOperations();
  const { accounts, selectedAccount } = useAppContext();
  const { selectedFolder } = useFolderOperations();
  const { selectedMessage } = useInboxState();
  const paneFolder = selectedFolder || selectedMessage?.folder || "INBOX";
  const { preferences } = useUserPreferences();
  const undoSendAvailable = useFeatureAvailable("undo_send");

  const routeFields = React.useMemo(
    () =>
      parseComposeRouteFields(
        location.search,
        typeof window === "undefined" ? "" : window.location.search,
      ),
    [location],
  );
  const hasIncomingRoute = Object.values(routeFields).some(Boolean);
  // The mounted form first owns any restored draft. External payloads start a
  // separate session through its save/discard guard instead of mixing prefills.
  const incomingFields = hasIncomingRoute ? {} : (initialFields ?? routeFields);

  const composeData = composerCtx.composeData;
  const toRecipients = React.useMemo(
    () => parseEmailString(incomingFields.to || composeData.to || ""),
    [composeData.to, incomingFields.to],
  );
  const ccRecipients = React.useMemo(
    () => parseEmailString(incomingFields.cc || composeData.cc || ""),
    [composeData.cc, incomingFields.cc],
  );
  const bccRecipients = React.useMemo(
    () => parseEmailString(incomingFields.bcc || composeData.bcc || ""),
    [composeData.bcc, incomingFields.bcc],
  );

  const closeCompose = React.useCallback(() => {
    if (pendingIncoming.current) return;
    if (selectedAccount) {
      savePaneMode(selectedAccount, paneFolder, "reading");
    }
    composerCtx.setComposeData({
      to: "",
      cc: "",
      bcc: "",
      subject: "",
      body: "",
      contentType: undefined,
      mode: "new",
      attachments: [],
      is_reply: false,
    });
    if (onClose) {
      onClose();
      return;
    }
    back.pop();
  }, [back, composerCtx, onClose, selectedAccount, paneFolder]);

  const composeMode =
    composeData.mode ?? (composeData.is_reply ? "reply" : "new");
  // Null on Free, where scheduled emails do not exist.
  const scheduledEmails = useOptionalScheduledEmails();
  const refreshScheduledEmails = React.useCallback(() => {
    void Promise.resolve(scheduledEmails?.refreshEmails()).catch(
      () => undefined,
    );
  }, [scheduledEmails]);
  const handleSendSuccess = React.useCallback(() => {
    if (
      preferences.auto_archive &&
      composeData.replySource &&
      (composeMode === "reply" || composeMode === "reply-all")
    ) {
      void archiveMessage(
        composeData.replySource.identity,
        composeData.replySource,
      );
    }
  }, [
    archiveMessage,
    composeData.replySource,
    composeMode,
    preferences.auto_archive,
  ]);

  const form = useComposeForm({
    mode: composeMode,
    prefillTo: toRecipients,
    prefillCc: ccRecipients,
    prefillBcc: bccRecipients,
    prefillSubject: incomingFields.subject || composeData.subject || "",
    prefillBody: incomingFields.body || composeData.body || "",
    defaultContentType:
      composeData.contentType ??
      (preferences.composer_default_format === "plain_text" ? "plain" : "html"),
    editorRef,
    autoSaveOnClose: preferences.auto_save_drafts,
    undoSendEnabled:
      __IS_PRO__ && undoSendAvailable && preferences.undo_send_enabled,
    undoSendDelaySeconds: preferences.undo_send_delay_seconds,
    onClose: closeCompose,
    onSendSuccess: handleSendSuccess,
    // Route the global navigation guard (route changes, wp-admin links)
    // through this compose instance so leaving a dirty mobile draft prompts.
    gateNavigation: true,
    composerContext: composerCtx,
    onScheduledChanged: refreshScheduledEmails,
  });

  // useComposeForm registers its navigation guard before this effect runs.
  React.useEffect(() => {
    if (!hasIncomingRoute || pendingIncoming.current) return;
    // Consume each route entry once. The same external payload is a new request
    // when opened again, including after Keep Editing.
    if (handledIncoming.current === location) return;
    handledIncoming.current = location;
    pendingIncoming.current = true;
    const finish = () => {
      pendingIncoming.current = false;
      consumeIncomingPayload();
      // Keep router state in step with browser URL cleanup. This replacement
      // only removes payload keys, so the route blocker keeps the current draft.
      navigate(
        {
          pathname: location.pathname,
          search: consumeComposeRouteSearch(location.search),
          hash: location.hash,
        },
        { replace: true, state: location.state },
      );
    };
    composerCtx.requestNavigation(
      () => {
        composerCtx.setComposeData({
          ...DEFAULT_COMPOSE_DATA,
          ...routeFields,
          contentType: "plain",
        });
        finish();
      },
      { onCancel: finish },
    );
  }, [composerCtx, hasIncomingRoute, location, navigate, routeFields]);

  const isDeliveryPending =
    form.isSending ||
    form.readReceipt?.pending ||
    form.isScheduling ||
    form.isDiscarding ||
    form.pendingInlineImageUploads > 0;

  const isDirty =
    form.pendingInlineImageUploads > 0 ||
    Boolean(
      form.toRecipients.length ||
      form.ccRecipients.length ||
      form.bccRecipients.length ||
      form.subject ||
      form.body ||
      form.attachments.length,
    );

  const setDragBackDisabled = layout?.setDragBackDisabled;
  React.useEffect(() => {
    if (!setDragBackDisabled) return;
    setDragBackDisabled(isDirty);
    return () => setDragBackDisabled(false);
  }, [isDirty, setDragBackDisabled]);

  return (
    <MobileScreen
      disableEdgeSwipeBack={isDirty}
      header={
        <MobileScreenHeader
          title={form.modeTitle || "New message"}
          hideTitle
          onBack={form.handleDiscard}
          onCancel={form.handleDiscard}
          trailing={
            <div className="flex items-center gap-0.5">
              {/* Explicit save (desktop parity: ComposerHeaderActions Save
                  Draft). Icon-only, the header has no room for two labels. */}
              <button
                type="button"
                onClick={() => void form.handleSaveDraft()}
                data-test="save-draft-button"
                data-saving={form.isSavingDraft ? "true" : undefined}
                aria-busy={form.isSavingDraft || undefined}
                aria-label={__("Save draft", "pressedmail")}
                disabled={form.isSavingDraft || isDeliveryPending}
                className={cn(
                  "pm-touch-target pm-no-tap-highlight inline-flex items-center justify-center rounded-full px-2",
                  form.isSavingDraft ? "text-muted-foreground" : "text-primary",
                )}>
                {form.isSavingDraft ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              <ComposerReadReceiptButton
                form={form}
                isDeliveryPending={isDeliveryPending}
                variant="compact"
              />
              <MobileScheduleActions
                form={form}
                isDeliveryPending={isDeliveryPending}
              />
              <button
                type="button"
                onClick={() => void form.handleSend()}
                data-test="send-button"
                data-sending={form.isSending ? "true" : undefined}
                aria-busy={form.isSending || undefined}
                disabled={!form.canSend || isDeliveryPending}
                className={cn(
                  "pm-touch-target pm-no-tap-highlight inline-flex items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold",
                  form.isSending
                    ? "text-success"
                    : !form.canSend
                      ? "text-muted-foreground"
                      : "text-primary",
                )}>
                {form.isSending ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <EmailSendIcon className="h-4 w-4" aria-hidden="true" />
                )}
                {/* Kept as a bare text node: the mobile tests find this button
                  with getByText(/send/i). These two strings were also the only
                  send labels in the app never passed through __(). */}
                {form.isSending
                  ? __("Sending...", "pressedmail")
                  : __("Send", "pressedmail")}
              </button>
            </div>
          }
        />
      }>
      {form.pendingInlineImageUploads > 0 && (
        <span className="sr-only" aria-live="polite">
          {__("Uploading image...", "pressedmail")}
        </span>
      )}
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center border-b border-border bg-card px-4 py-3">
          <label
            htmlFor="pm-mobile-compose-from"
            className="w-16 shrink-0 text-sm text-muted-foreground">
            From
          </label>
          {accounts.length > 1 ? (
            <select
              id="pm-mobile-compose-from"
              value={form.fromAccount}
              onChange={(event) => form.setFromAccount(event.target.value)}
              disabled={isDeliveryPending}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none disabled:text-muted-foreground">
              {accounts.map((account) => (
                <option key={account.id ?? account.email} value={account.email}>
                  {account.email}
                </option>
              ))}
            </select>
          ) : (
            <span
              id="pm-mobile-compose-from"
              className="min-w-0 flex-1 truncate text-sm">
              {form.fromAccount || "No account selected"}
            </span>
          )}
        </div>
        <ComposerContent
          form={form}
          editorRef={editorRef}
          variant="mobile"
          showHeader={false}
          className="min-h-0 flex-1"
        />
      </div>
    </MobileScreen>
  );
}

export default MobileComposeScreen;
