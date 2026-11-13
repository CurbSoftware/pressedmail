import { useCallback, useEffect, useState } from "react";

/**
 * Holds an action on the open message until its detail load settles.
 *
 * A message picked from the list is a list row first: its body and files only
 * arrive when the detail fetch merges them in. An action that needs them
 * (Reply, Reply all, Forward) pressed in that gap waits here and runs when the
 * load ends, whether it worked or not, so it never hangs. Only the last action
 * pressed during the wait runs.
 *
 * `key` names what the action was pressed on, at least the message's identity
 * key. If it changes during the wait the action is dropped: the user moved on.
 * `isLoading` is the inbox's `isMessageDetailLoading`. `run` is called in its
 * latest form, so it sees the loaded message.
 */
export function useAfterDetailLoad<Action>(
  key: string,
  isLoading: boolean,
  run: (action: Action) => void,
): (action: Action) => void {
  const [waiting, setWaiting] = useState<{
    key: string;
    action: Action;
  } | null>(null);

  useEffect(() => {
    if (!waiting) return;
    if (waiting.key === key && isLoading) return;
    setWaiting(null);
    if (waiting.key === key) run(waiting.action);
  }, [waiting, key, isLoading, run]);

  return useCallback(
    (action: Action) => {
      if (isLoading) setWaiting({ key, action });
      else run(action);
    },
    [key, isLoading, run],
  );
}
