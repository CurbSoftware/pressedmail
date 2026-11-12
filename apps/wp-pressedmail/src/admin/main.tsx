import ReactDOM from "react-dom/client";

import { EditionApp } from "@/admin/EditionApp.active";

import { installInputModality } from "@/lib/input-modality";
import { initializePrincipalStorage } from "@/lib/principal-storage";
import { installStaleChunkReload } from "@/lib/stale-chunk-reload";

import "./index.css";
// Pro only: the eight premium palettes. The Free alias target is empty, so the
// WordPress.org stylesheet never carries theme CSS the Free app cannot select.
// Imported after index.css so these rules keep their old cascade position.
import "@/styles/premium-themes.css";

installStaleChunkReload(import.meta.url);
installInputModality();

let appRoot: ReturnType<typeof ReactDOM.createRoot> | null = null;
const bootPrincipal = initializePrincipalStorage(() => {
  // Identity checks may run during render. Finish that stack, then remove all
  // providers, portals and beforeunload guards before attempting navigation.
  queueMicrotask(() => {
    appRoot?.unmount();
    window.location.reload();
  });
});

const rootElement = document.getElementById("pressedmail-plugin");

if (bootPrincipal === null) {
  // PHP's boot data is missing or unreadable: an optimisation plugin dropped
  // or reordered the inline script, or a filter made the REST root relative.
  // Every request would then fail as an expired session, so the page says it
  // could not load (the notice Admin/Menu.php renders) instead of mounting.
  const loading = document.getElementById("pressedmail-plugin-loading");
  const failed = document.getElementById("pressedmail-plugin-failed");
  if (loading) loading.hidden = true;
  if (failed) failed.hidden = false;
} else if (rootElement) {
  appRoot = ReactDOM.createRoot(rootElement);
  appRoot.render(<EditionApp />);
}
