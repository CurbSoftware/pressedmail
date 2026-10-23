import ReactDOM from "react-dom/client";

import { EditionApp } from "@/admin/EditionApp.active";

import { initializePrincipalStorage } from "@/lib/principal-storage";
import { installStaleChunkReload } from "@/lib/stale-chunk-reload";

import "./index.css";
// Pro only: the eight premium palettes. The Free alias target is empty, so the
// WordPress.org stylesheet never carries theme CSS the Free app cannot select.
// Imported after index.css so these rules keep their old cascade position.
import "@/styles/premium-themes.css";

installStaleChunkReload(import.meta.url);

let appRoot: ReturnType<typeof ReactDOM.createRoot> | null = null;
initializePrincipalStorage(() => {
  // Identity checks may run during render. Finish that stack, then remove all
  // providers, portals and beforeunload guards before attempting navigation.
  queueMicrotask(() => {
    appRoot?.unmount();
    window.location.reload();
  });
});

const rootElement = document.getElementById("pressedmail-plugin");

if (rootElement) {
  appRoot = ReactDOM.createRoot(rootElement);
  appRoot.render(<EditionApp />);
}
