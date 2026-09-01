/**
 * Shared types for the WordPress system-email (wp_mail) SMTP surfaces.
 *
 * One SMTP connection is described the same way whether it is being edited in
 * the settings tab or exercised by a connection test, so the form component, the
 * test panel, and the REST client all speak these types.
 */

export type SmtpSecurity = "none" | "ssl" | "tls";

/**
 * One editable SMTP connection.
 *
 * The optional fields are the multi-connection extensions. A surface that does
 * not offer them simply leaves them undefined, and the form hides the
 * corresponding controls via {@link SmtpConnectionCapabilities}.
 */
export interface SmtpConnectionValue {
  enabled: boolean;
  host: string;
  port: number;
  security: SmtpSecurity;
  auth: boolean;
  username: string;
  /** Empty keeps the stored password. It is never echoed back to the client. */
  password: string;
  fromEmail: string;
  fromName: string;
  /** Admin-facing name. Only meaningful when more than one connection exists. */
  label?: string;
  /** Override the From even when a plugin set one explicitly. */
  forceFrom?: boolean;
  /** From addresses routed to this connection. Pro only. */
  fromAddresses?: string[];
}

/**
 * What the current edition and license allow, as reported by the server.
 *
 * The client never infers these from a build flag: the REST layer is the single
 * source of truth, so a downgraded site cannot be talked into showing controls
 * the server would reject.
 */
export interface SmtpConnectionCapabilities {
  /** Maximum connections. 0 means unlimited. */
  maxConnections: number;
  /** Route by From address across several connections. */
  routing: boolean;
  /** Retry a failed send through a nominated connection. */
  fallback: boolean;
  /** Offer the per-connection force-From override. */
  forceFrom: boolean;
}

export const SINGLE_CONNECTION_CAPABILITIES = {
  routing: false,
  fallback: false,
  forceFrom: false,
} as SmtpConnectionCapabilities;

export interface SmtpConnectionFormErrors {
  label?: string;
  host?: string;
  port?: string;
  security?: string;
  username?: string;
  password?: string;
  fromEmail?: string;
  fromAddresses?: string;
}

export interface SmtpTestPanelErrors {
  testRecipient?: string;
  submit?: string;
}

export interface SmtpStatusMessage {
  kind: "success" | "error" | "info";
  message: string;
}
