import { __ } from "@wordpress/i18n";
import { FlaskConical, ShieldAlert } from "lucide-react";

import { Alert, AlertDescription, Card, CardContent, CardHeader, CardTitle } from "@kit/ui/plugin";

/**
 * Guidance panel for the advanced Proton Mail Bridge flow. Rendered above the
 * editable server fields when the protonmail provider is selected.
 */
export function ProtonBridgePanel() {
  return (
    <Card data-test="proton-bridge-panel" data-testid="proton-bridge-panel">
      <CardHeader className="space-y-1 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base font-semibold">
            {__("Proton Mail requires Proton Mail Bridge", "pressedmail")}
          </CardTitle>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <FlaskConical className="h-3 w-3" aria-hidden="true" />
            {__("Experimental", "pressedmail")}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          {__(
            "Proton keeps mailboxes end-to-end encrypted, so there is no public Proton IMAP server. Proton Mail Bridge (available on a paid Proton plan) decrypts your mailbox and provides private IMAP/SMTP servers for email clients.",
            "pressedmail",
          )}
        </p>

        <p className="font-medium">
          {__(
            "Bridge must be reachable from your WordPress server. It is your web server that connects to Bridge, not your browser. The default 127.0.0.1 means Bridge runs on the same machine as WordPress itself.",
            "pressedmail",
          )}
        </p>

        <p className="text-muted-foreground">
          {__(
            "Use the username and password credentials shown in the Bridge app (not your Proton account password), and copy the exact IMAP/SMTP ports from Bridge. It can assign different ports when the defaults are taken.",
            "pressedmail",
          )}
        </p>

        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            {__(
              "Never expose the Bridge IMAP/SMTP ports to the public internet. If Bridge runs on another machine, connect over a private network, tunnel, or firewall rules only.",
              "pressedmail",
            )}
          </AlertDescription>
        </Alert>

        <p className="text-xs text-muted-foreground">
          {__(
            "Alternative for sending only: Pro users can send through Proton's smtp.protonmail.ch with an SMTP token via Custom SMTP (custom-domain addresses, no inbox access).",
            "pressedmail",
          )}
        </p>
      </CardContent>
    </Card>
  );
}
