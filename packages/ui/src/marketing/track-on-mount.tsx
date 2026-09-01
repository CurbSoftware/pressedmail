'use client';

import { useEffect, useRef } from 'react';

import type { UmamiEventName } from '@kit/shared/analytics';
import { onUmamiReady, trackUmamiEvent } from '@kit/shared/analytics';

/**
 * Record an event when a page renders in a state worth counting.
 *
 * Server components cannot call the tracker, and some of the most useful
 * signals are states rather than clicks: a rejected checkout email, a 404, a
 * completed purchase. Dropping this component into that branch records it
 * without turning the whole page into a client component.
 *
 * Fires once per mount, but waits for the tracker: the script loads after
 * React mounts, so firing immediately would drop the event on exactly the
 * pages this component exists for.
 *
 * Strict Mode double-invokes effects in development, so the ref guard is what
 * keeps the count honest there.
 */
export function TrackOnMount({
  event,
  payload,
}: {
  event: UmamiEventName;
  payload?: Record<string, unknown>;
}) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) {
      return;
    }

    tracked.current = true;

    return onUmamiReady(() => trackUmamiEvent(event, payload));
    // The payload is a fresh object literal on every render; depending on it
    // would re-run this effect forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  return null;
}
