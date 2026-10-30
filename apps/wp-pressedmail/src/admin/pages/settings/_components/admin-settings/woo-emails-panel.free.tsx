"use client";

/**
 * Free's WooCommerce panel: nothing. The Woo Bridge companion requires
 * PressedMail Pro, so the Free bundle resolves this twin (see
 * `edition-aliases.cjs` and `woo-emails-panel.active.tsx`) and never ships the
 * panel itself. The props match the Pro panel's, so a tool that resolves the
 * barrel literally still typechecks the call site.
 */

import type { RegisterSettingsDraft } from "@/components/settings-ui";
import type { WpMailConnectionView } from "@/lib/wp-mail-api";

export interface WooEmailsPanelProps {
  /** The site's SMTP connections, from the host tab's own state. */
  connections: WpMailConnectionView[];
  /** The host tab's draft registry. */
  registerDraft?: RegisterSettingsDraft;
}

/** The key the Pro panel registers its draft under; the tab's save bar reads it. */
export const WOO_EMAILS_DRAFT = "woo-emails";

export function WooEmailsPanel(_props: WooEmailsPanelProps) {
  return null;
}
