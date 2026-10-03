/**
 * Shared types for the WordPress system-email (wp_mail) SMTP surfaces.
 *
 * One SMTP connection is described the same way whether it is being edited in
 * the settings tab or exercised by a connection test, so the form component, the
 * test panel, and the REST client all speak these types.
 */

export type SmtpSecurity = "none" | "ssl" | "tls";

/**
 * How the server authenticates the login.
 *
 * "" is Automatic: PHPMailer negotiates against the server's advertised AUTH
 * list, which is what almost every host expects. The rest are set explicitly
 * for the hosts that need it.
 */
export type SmtpAuthType = "" | "login" | "plain" | "cram-md5";

/** Login-method options, in the order the form offers them. */
export const SMTP_AUTH_TYPES: SmtpAuthType[] = [
  "",
  "login",
  "plain",
  "cram-md5",
];

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
  /** Login method. Empty means Automatic. */
  authType: SmtpAuthType;
  username: string;
  /** Empty keeps the stored password. It is never echoed back to the client. */
  password: string;
  fromEmail: string;
  fromName: string;
  /** Admin-facing name. Only meaningful when more than one connection exists. */
  label?: string;
  /** Override the From even when a plugin set one explicitly. */
  forceFrom?: boolean;
  /**
   * The connection's other senders, beside `fromEmail`. Each one is a selectable
   * sender for a template or a system email, and still routes that From address
   * through this connection. Pro only.
   */
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
  /** Several connections, a selectable sender on each. */
  routing: boolean;
  /** Offer the per-connection force-From override. */
  forceFrom: boolean;
}

export const SINGLE_CONNECTION_CAPABILITIES = {
  routing: false,
  forceFrom: false,
} as SmtpConnectionCapabilities;

/** The four answers `POST /wp-mail/senders/probe` can return. */
export type SmtpSenderProbeResult =
  | "accepted"
  | "rejected"
  | "inconclusive"
  | "unreachable";

/**
 * What the server made of one sender address.
 *
 * `accepted` means the server accepted it as the sender for this login, which
 * is not a promise of delivery: a provider can still refuse the address once
 * the message is delivered.
 */
export interface SmtpSenderProbe {
  result: SmtpSenderProbeResult;
  /** The SMTP reply code, or 0 when the server said nothing usable. */
  code: number;
  /** The server's own reply, already sanitized and truncated. */
  detail: string;
  /**
   * The server's own sentence about this verdict, already sanitized.
   *
   * Read where the client cannot know what happened: an `unreachable` verdict
   * covers both a server that was never reached and one that answered about
   * the session (530, 538, 503, 554), and only the server can say which. The
   * other three verdicts have copy here that says more than the server's
   * generic line does.
   */
  message: string;
}

/** One address's test: in flight, done, or refused before it was sent. */
export type SmtpSenderTest =
  | { state: "testing" }
  | { state: "done"; probe: SmtpSenderProbe }
  | { state: "error"; message: string };

export interface SmtpConnectionFormErrors {
  label?: string;
  host?: string;
  port?: string;
  security?: string;
  authType?: string;
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
