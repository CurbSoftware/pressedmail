import ReactDOM from "react-dom/client";

import { EditionApp } from "@/admin/EditionApp.active";
import { applyInjectedLocaleData } from "@/lib/i18n-boot";
import { maybeForwardCalendarOAuthCallback } from "@/lib/calendar-oauth-callback";

import "./index.css";

// If this window is an OAuth popup returning to the plugin page, hand the code
// back to the opener and close instead of booting the whole app.
if (!maybeForwardCalendarOAuthCallback()) {
  // Apply server-provided translations before the edition-specific app renders.
  applyInjectedLocaleData();

  const rootElement = document.getElementById("pressedmail-plugin");

  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(<EditionApp />);
  }
}
