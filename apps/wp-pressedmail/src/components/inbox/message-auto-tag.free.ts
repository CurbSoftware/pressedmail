/**
 * Free has no AI auto-tag, so it builds no classify request. See
 * message-auto-tag.pro.ts.
 */
import type { MutableRefObject } from "react";

import type { MessageIdentityRef } from "@/lib/message-identity";
import type { StoragePrincipal } from "@/lib/principal-storage";

export interface MessageAutoTagScope<S> {
  tagIdentity: MessageIdentityRef | null;
  tagScope: S;
  tagMutation: MutableRefObject<S | null>;
  tagReadVersion: MutableRefObject<number>;
  setPendingTagScope: (scope: S | null) => void;
  isCurrentTagScope: (scope: S, principal: StoragePrincipal | null) => boolean;
  invalidateTagCaches: (principal: StoragePrincipal | null) => void;
  reloadMessageTags: (principal: StoragePrincipal | null) => Promise<void>;
}

export interface MessageAutoTag {
  available: boolean;
  isAutoTagging: boolean;
  autoTag: (() => Promise<void>) | undefined;
}

// Callers read the result only behind `!__IS_FREE__`, so this build never
// looks inside it and it carries no member names.
export function useActionBarAutoTag(..._args: unknown[]): MessageAutoTag {
  return null as never;
}

export function useMailDisplayAutoTag(..._args: unknown[]): MessageAutoTag {
  return null as never;
}
