import type { Dispatch, SetStateAction } from "react";

import { useAppContext } from "@/context/AppProvider";
import { useFeatureAvailableOrPending } from "@/context/features/FeaturesContext";

const NO_IDS: number[] = [];
const ignoreIds: Dispatch<SetStateAction<number[]>> = () => {};

/**
 * The mailboxes a combined view reads. A single-mailbox build has no combined
 * view: this answers none there and never reads the app context for it.
 */
export function useCombinedAccountIds(): number[] {
  const app = useAppContext();
  return __SINGLE_MAILBOX__
    ? NO_IDS
    : (app.selectedConsolidatedAccountIds ?? NO_IDS);
}

/** Sets the mailboxes a combined view reads. A no-op in a single-mailbox build. */
export function useSetCombinedAccountIds(): Dispatch<
  SetStateAction<number[]>
> {
  const app = useAppContext();
  return __SINGLE_MAILBOX__
    ? ignoreIds
    : (app.setSelectedConsolidatedAccountIds ?? ignoreIds);
}

/**
 * Whether a combined view can be offered. Read behind the define, so a
 * single-mailbox build never asks and names no combined feature.
 */
export const useCombinedViewAvailable: () => boolean = __SINGLE_MAILBOX__
  ? () => false
  : () => useFeatureAvailableOrPending("combined_inbox");
