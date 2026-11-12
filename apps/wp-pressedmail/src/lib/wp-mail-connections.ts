/**
 * What a WordPress email connection is, read off the settings payload. Kept
 * apart from wp-mail-api.ts, which tests replace whole, so every screen that
 * asks reads one answer.
 */

import type { WpMailConnectionView, WpMailState } from "@/lib/wp-mail-api";

/** The type of a connection PressedMail sends through an SMTP server itself. */
export const SMTP_TYPE = "smtp";

/** A connection another plugin provides: no SMTP fields, its own form. A blank type is SMTP. */
export const isExternalConnection = (connection: Pick<WpMailConnectionView, "type">): boolean =>
  (connection.type || SMTP_TYPE) !== SMTP_TYPE;

/**
 * Whether WordPress email reaches past SMTP on this site: another plugin
 * provides a connection type, or a saved connection is one. The page then
 * says "connection" where it said "SMTP account"; until then it reads as it
 * always has. Reads a partial payload too, as some screens hold one.
 */
export const usesExternalConnections = (
  state: Partial<Pick<WpMailState, "capabilities" | "connections">>,
): boolean =>
  (state.capabilities?.transports?.length ?? 0) > 0 ||
  (state.connections ?? []).some(isExternalConnection);
