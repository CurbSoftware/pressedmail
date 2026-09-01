'use client';

/**
 * Discussion store plugin (template discussion-kit.tsx port).
 *
 * Purely UI: stores discussions and users in plugin options. PressedMail
 * keeps this editor-local and in-memory, no mock/faker data, no avatar
 * URLs. The only user is the current WordPress user ('me'), whose display
 * name comes from the window.pressedmailPlugin boot global; avatars render
 * initials via AvatarFallback.
 */

import { createPlatePlugin } from '@kit/plate/react';
import { __ } from '@wordpress/i18n';

import { BlockDiscussion } from './block-discussion';
import type { TComment } from './comment';

export type TDiscussion = {
  id: string;
  comments: TComment[];
  createdAt: Date;
  isResolved: boolean;
  userId: string;
  documentContent?: string;
};

export type TDiscussionUser = {
  id: string;
  name: string;
  avatarUrl?: string;
  hue?: number;
};

const BLOCK_SUGGESTION_SELECTOR = '[data-block-suggestion="true"]';

const getTargetElement = (target: EventTarget | null) => {
  if (target instanceof HTMLElement) return target;
  if (target instanceof Node) return target.parentElement;

  return null;
};

export const getDiscussionClickTarget = ({
  selector,
  target,
}: {
  selector: string;
  target: EventTarget | null;
}) => {
  const element = getTargetElement(target);

  if (!element) return null;

  return element.closest(selector) as HTMLElement | null;
};

export const getDiscussionBlockClickTarget = ({
  selector = BLOCK_SUGGESTION_SELECTOR,
  target,
}: {
  selector?: string;
  target: EventTarget | null;
}) =>
  getDiscussionClickTarget({
    selector,
    target,
  });

/** Minimal typing for the current-user slice of the WP boot global. */
interface PressedMailCurrentUserGlobal {
  pressedmailPlugin?: {
    currentUser?: {
      displayName?: string;
      name?: string;
    };
  };
}

const getCurrentUserName = (): string => {
  if (typeof window === 'undefined') return __('You', 'pressedmail');

  const globals = window as unknown as PressedMailCurrentUserGlobal;

  return (
    globals.pressedmailPlugin?.currentUser?.displayName ??
    globals.pressedmailPlugin?.currentUser?.name ??
    __('You', 'pressedmail')
  );
};

const usersData: Record<string, TDiscussionUser> = {
  me: {
    id: 'me',
    name: getCurrentUserName(),
  },
};

// This plugin is purely UI. It's only used to store the discussions and users data
export const discussionPlugin = createPlatePlugin({
  key: 'discussion',
  options: {
    currentUserId: 'me',
    discussions: [] as TDiscussion[],
    users: usersData,
  },
})
  .configure({
    render: { aboveNodes: BlockDiscussion },
  })
  .extendSelectors(({ getOption }) => ({
    currentUser: () => getOption('users')[getOption('currentUserId')],
    user: (id: string) => getOption('users')[id],
  }));

export const DiscussionKit = [discussionPlugin];
