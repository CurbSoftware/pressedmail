/**
 * Free edition: blocks are Pro, so the composer has no Insert block button and
 * its slash menu has no Blocks group. Both entry points resolve here and render
 * or offer nothing, instead of carrying the Pro picker behind a runtime check.
 *
 * The item shape mirrors the real kit so call sites typecheck identically in
 * both editions. Type imports are erased at build time.
 */
import type * as React from 'react';

import type { PlateEditor } from '@kit/plate/react';

export interface ComposerBlockSlashItem {
  icon: React.ReactNode;
  label: string;
  value: string;
  keywords?: string[];
  onSelect: (editor: PlateEditor) => void;
}

export interface ComposerBlockSlashGroup {
  group: string;
  items: ComposerBlockSlashItem[];
}

export interface ContentBlocksProviderProps {
  enabled: boolean;
  /** The address the email is to, when it is to exactly one person. */
  recipient?: string;
  /** The mailbox the email is sent from. */
  accountId?: number;
  /** Keep fields as written while building a reusable template. */
  preserveFields?: boolean;
  /** Full-list emails resolve preserved fields for each recipient at delivery. */
  listDelivery?: boolean;
  children: React.ReactNode;
}

// One stable reference: callers spread it into a list every render.
const NO_GROUPS: ComposerBlockSlashGroup[] = [];

export function ContentBlocksProvider({ children }: ContentBlocksProviderProps) {
  return <>{children}</>;
}

export function InsertBlockToolbarButton() {
  return null;
}

export function useBlocksSlashGroups(): ComposerBlockSlashGroup[] {
  return NO_GROUPS;
}
