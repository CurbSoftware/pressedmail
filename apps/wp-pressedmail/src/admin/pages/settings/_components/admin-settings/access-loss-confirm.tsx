import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { __, sprintf } from "@wordpress/i18n";

import { ConfirmationPanel } from "@/components/shared/ConfirmationPanel";

import { accessLossEffects } from "./access-staged-notice";

/**
 * Up to two names, then how many more, for a sentence about a few people. The
 * total may be larger than the names given: the server names two and counts the
 * rest.
 */
export function nameList(names: string[], total: number = names.length): string {
  const shown = names.slice(0, 2).join(", ");

  return total > 2
    ? `${shown} ${sprintf(
        /* translators: %d: how many more people are not listed by name. */
        __("and %d more", "pressedmail"),
        total - 2,
      )}`
    : shown;
}

export interface AccessLossPrompt {
  /** The question, counted and worded for this save. */
  title: string;
  /** Who it is about, said before the list of what stops. */
  lead: string;
  /** Anything else worth saying once, such as a Deny that changes nothing today. */
  note?: string;
}

function AccessLossBody({ prompt }: { prompt: AccessLossPrompt }) {
  // The description is a paragraph, so everything in it is inline-level: the
  // list is spans with list roles, which is valid markup and still a list.
  return (
    <>
      <span className="block">{prompt.lead}</span>
      <span className="mt-3 block">
        {__("While someone has no access:", "pressedmail")}
      </span>
      <span role="list" className="mt-1.5 block space-y-1.5">
        {accessLossEffects().map((effect) => (
          <span key={effect} role="listitem" className="flex gap-2">
            <span aria-hidden="true">&bull;</span>
            <span>{effect}</span>
          </span>
        ))}
      </span>
      {prompt.note ? (
        <span className="mt-3 block">{prompt.note}</span>
      ) : null}
    </>
  );
}

/**
 * Ask before a save takes access away from someone, once, at the moment it
 * matters. The warning used to sit above the list and push every row down the
 * moment a Deny was picked, which moved the row the admin had just pressed out
 * from under the pointer. The list stays still now, and this says it all when
 * they commit.
 *
 * `confirm` resolves true to go ahead and false to keep editing, and asking
 * twice while a question is open gives the same answer, so a double press on
 * Save cannot stack two of them. A question that is still open when the panel
 * goes away is answered no.
 */
export function useAccessLossConfirm(): {
  confirm: (prompt: AccessLossPrompt) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [prompt, setPrompt] = useState<AccessLossPrompt | null>(null);
  const [open, setOpen] = useState(false);
  const waiting = useRef<{
    promise: Promise<boolean>;
    settle: (ok: boolean) => void;
  } | null>(null);

  const confirm = useCallback((next: AccessLossPrompt) => {
    if (waiting.current) return waiting.current.promise;

    let settle: (ok: boolean) => void = () => {};
    const promise = new Promise<boolean>((resolve) => {
      settle = resolve;
    });

    waiting.current = { promise, settle };
    setPrompt(next);
    setOpen(true);

    return promise;
  }, []);

  const answer = useCallback((ok: boolean) => {
    const current = waiting.current;

    waiting.current = null;
    setOpen(false);
    current?.settle(ok);
  }, []);

  useEffect(
    () => () => {
      waiting.current?.settle(false);
      waiting.current = null;
    },
    [],
  );

  const dialog = (
    <ConfirmationPanel
      open={open}
      onOpenChange={() => {}}
      title={prompt?.title ?? ""}
      description={prompt ? <AccessLossBody prompt={prompt} /> : null}
      variant="destructive"
      confirmText={__("Remove access", "pressedmail")}
      cancelText={__("Keep editing", "pressedmail")}
      onConfirm={() => answer(true)}
      onCancel={() => answer(false)}
    />
  );

  return { confirm, dialog };
}
