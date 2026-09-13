import * as React from "react";
import { __ } from "@wordpress/i18n";
import {
  getMessageIdentityRef,
  getMessageIdentityKey,
} from "@/lib/message-identity";
import {
  captureRequestPrincipal,
  isRequestPrincipalCurrent,
} from "@/lib/principal-storage";

import { appMessage } from "@/context/toast";
import { useFilterOperations } from "@/context/InboxContext";
import { useTags } from "@/context/tags";
import { getInboxService } from "@/services/implementations";
import { toggleTagFilterId } from "@/components/tags/tag-filter-utils";
import type { EmailMessage, EmailMessageTag } from "@/types";

interface RemoveMessageTagOptions {
  accountId?: number | null;
  folder?: string;
}

export function useEmailMessageTagActions() {
  const { activeFilters, applyFilters } = useFilterOperations();
  const { removeTag, getMessageTags } = useTags();

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
      _options: RemoveMessageTagOptions = {},
    ) => {
      const ref = getMessageIdentityRef(message);
      const localMessageId = getMessageIdentityKey(message);
      const principal = captureRequestPrincipal();
      if (!ref || !localMessageId || !principal) return;
      try {
        await removeTag(
          tag.id,
          ref.accountId,
          ref.uid,
          ref.folder,
          ref.uidValidity,
        );
        if (!isRequestPrincipalCurrent(principal)) return;
        const tags = await getMessageTags(
          ref.accountId,
          ref.uid,
          ref.folder,
          ref.uidValidity,
        );
        if (isRequestPrincipalCurrent(principal))
          getInboxService().updateMessage(localMessageId, { tags });
      } catch (error) {
        if (isRequestPrincipalCurrent(principal)) {
          // A tag chip's x used to fail in total silence: the console got the
          // error, the user watched the chip stay exactly where it was.
          console.error("Failed to remove message tag:", error);
          appMessage(
            __("That tag could not be removed. Try again.", "pressedmail"),
            "error",
          );
        }
      }
    },
    [removeTag, getMessageTags],
  );

  return {
    filterByTag,
    removeMessageTag,
  };
}
