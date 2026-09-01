import * as React from "react";

import { useFilterOperations } from "@/context/InboxContext";
import { useTags } from "@/context/tags";
import { getInboxService } from "@/services/implementations";
import { toggleTagFilterId } from "@/components/tags/tag-filter-utils";
import type { EmailMessage, EmailMessageTag } from "@/types";

interface RemoveMessageTagOptions {
  accountId?: number | null;
  folder?: string;
}

function resolveLocalMessageId(message: EmailMessage): string | number {
  return (
    message.consolidatedUid ??
    message.id ??
    message.uid ??
    message.msg_no ??
    ""
  );
}

function resolveMessageUid(message: EmailMessage): string {
  return String(message.uid ?? message.msg_no ?? message.id ?? "");
}

export function useEmailMessageTagActions() {
  const { activeFilters, applyFilters } = useFilterOperations();
  const { removeTag } = useTags();

  const filterByTag = React.useCallback(
    (tag: EmailMessageTag) => {
      // Additive AND: toggle this tag in/out of the active filter set so
      // clicking chips on multiple messages narrows to mail carrying them all.
      const current = activeFilters ?? {};
      const next = toggleTagFilterId(current.tags ?? [], String(tag.id));
      applyFilters({ ...current, tags: next });
    },
    [activeFilters, applyFilters],
  );

  const removeMessageTag = React.useCallback(
    async (
      message: EmailMessage,
      tag: EmailMessageTag,
      options: RemoveMessageTagOptions = {},
    ) => {
      const accountId = Number(message.accountId ?? options.accountId);
      const messageUid = resolveMessageUid(message);
      const folder = message.folder ?? options.folder ?? "INBOX";
      const localMessageId = resolveLocalMessageId(message);

      if (!Number.isInteger(accountId) || accountId <= 0 || !messageUid) {
        return;
      }

      const previousTags = message.tags ?? [];
      const nextTags = previousTags.filter((item) => item.id !== tag.id);
      const inboxService = getInboxService();

      inboxService.updateMessage(localMessageId, { tags: nextTags });

      try {
        await removeTag(tag.id, accountId, messageUid, folder);
      } catch (error) {
        inboxService.updateMessage(localMessageId, { tags: previousTags });
        console.error("Failed to remove message tag:", error);
      }
    },
    [removeTag],
  );

  return {
    filterByTag,
    removeMessageTag,
  };
}
