import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useMobileShellFlag } from "@/components/mobile-shell/useMobileShellFlag";
import { usePaneCompose } from "@/context/composer";
import { useIsMobileOrTablet } from "@/hooks/useMobile";
import { parseComposeRouteFields } from "@/lib/mailto";

import MobileComposeScreen from "./mobile/MobileComposeScreen";

function DesktopComposeRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const paneCompose = usePaneCompose();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || !paneCompose) return;
    handled.current = true;

    const fields = parseComposeRouteFields(
      location.search,
      window.location.search,
    );
    if (Object.values(fields).some(Boolean)) {
      paneCompose.requestPaneComposeWithData({
        ...fields,
        // Mailto and GET share payloads are text, including literal HTML.
        contentType: "plain",
        attachments: [],
      });
    } else {
      // The compact composer consumes incoming URL fields once. A wider shell
      // remounts this route, so continue the shared session without clearing it.
      paneCompose.resumePaneCompose();
    }

    // Consume only the external payload. Keep the WordPress host page and any
    // unrelated query parameters when later opening a fresh compose window.
    const url = new URL(window.location.href);
    for (const key of [
      "pm_mailto",
      "pm_share_target",
      "pm_share_title",
      "pm_share_text",
      "pm_share_url",
    ]) {
      url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state, "", url);
    navigate("/inbox", { replace: true });
  }, [location.search, navigate, paneCompose]);

  return null;
}

export default function ComposeRoute() {
  const isMobileOrTablet = useIsMobileOrTablet();
  const mobileShellEnabled = useMobileShellFlag();

  return isMobileOrTablet && mobileShellEnabled ? (
    <MobileComposeScreen />
  ) : (
    <DesktopComposeRoute />
  );
}
