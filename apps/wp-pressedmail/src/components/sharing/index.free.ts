/**
 * Free build stand-in for the sharing module. Free has one mailbox by
 * construction and no sharing, so every export is inert: components render
 * nothing, nothing is ever shared, and every mailbox is the user's own.
 */
import type { ReactNode } from "react";

type SharedResourceLike = { share?: unknown };
export type MailboxRole = "owner";
export interface SharedMailboxRole {
  role: MailboxRole;
  isShared: false;
  canWrite: true;
  canManage: true;
  isOwner: true;
}

const OWNER: SharedMailboxRole = {
  role: "owner",
  isShared: false,
  canWrite: true,
  canManage: true,
  isOwner: true,
};
const nothing = (_props: Record<string, unknown>): null => null;
const idle = {
  isPending: false,
  mutate: () => undefined,
  reset: () => undefined,
};

export const ShareDialog = nothing;
export const SharedBadge = nothing;
export const SharedWithIcon = nothing;
export const LeaveShareMenuItem = nothing;
export const LeaveShareButton = nothing;
export const InboxShareDialog = nothing;
export const LockShareNote = nothing;
export const SharedAccountsSection = nothing;
export const ShareInboxButton = nothing;

export const isSharedResource = (
  _resource?: SharedResourceLike | null,
): boolean => false;
export const mailboxRoleOf = (_account?: unknown): MailboxRole => "owner";
export const sharedMailboxRoleOf = (_account?: unknown): SharedMailboxRole =>
  OWNER;
// Free roles always allow, so the refusal is never shown and carries no copy.
export const sharedRoleRefusal = (): string => "";
export const useSharedMailboxRole = (_accountId?: unknown): SharedMailboxRole =>
  OWNER;

export const useShares = (_options?: unknown) => ({
  shares: [] as never[],
  isLoading: false,
  error: null,
  create: idle,
  update: idle,
  remove: idle,
});
export const useShareCandidates = (..._args: unknown[]) => ({
  candidates: [] as never[],
  isLoading: false,
  error: null,
});
export const useLeaveShare = (..._args: unknown[]) => ({
  leave: (_resourceId: number, _label: string, _owner?: string): void =>
    undefined,
  isPending: false,
  dialog: null as ReactNode,
});
export const useShareRevocation = (_onRevoked?: unknown): void => undefined;
export const useSharedAccountRevocation = (..._args: unknown[]): void =>
  undefined;
export const useInboxShareActions = (
  _account?: unknown,
): { menuItems: ReactNode; dialog: ReactNode } => ({
  menuItems: null,
  dialog: null,
});
