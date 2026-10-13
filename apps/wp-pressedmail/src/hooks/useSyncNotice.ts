import { useSyncExternalStore } from "react";

import { getConnectionStateService } from "@/services/implementations/connection-state.service";
import type { SyncDelayedKind } from "@/services/interfaces/connection-state.interface";

const subscribe = (listener: () => void) =>
  getConnectionStateService().subscribe(listener);
const snapshot = () => getConnectionStateService().getSyncNotice();

/**
 * The "sync is running late" notice to show right now, or null.
 *
 * It is client-originated: the sync driver raises it from what it sees, nothing is stored on the
 * server, and the service decides when it shows (see `getSyncNotice`). The notifications panel
 * lists it and the bell wears a dot while it is up. The snapshot is a plain string, so a
 * component re-renders when the notice changes and not on every connection-state change.
 */
export function useSyncNotice(): SyncDelayedKind | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Hide the notice until the condition clears and comes back. */
export function dismissSyncNotice(): void {
  getConnectionStateService().dismissSyncNotice();
}
