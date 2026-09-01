/**
 * Email-stripping static leaves for comment + suggestion marks.
 *
 * Comments and suggestions are editor-local collaboration artifacts, they
 * must NEVER reach serialized email HTML. Registering the Base plugins with
 * these pass-through components makes the static serializer render only the
 * text children: no wrapper element, no classes, no data-* attributes
 * (SlateLeaf would emit a `data-slate-leaf` span; a bare fragment emits
 * nothing). Without the plugins registered, the serializer falls back to
 * attribute-encoding the unknown mark props (e.g.
 * `data-slate-comment-discussion-1="true"`), leaking artifacts into email.
 */

import type { SlateLeafProps } from '@kit/plate/static';

export function CommentLeafStatic(props: SlateLeafProps) {
  return <>{props.children}</>;
}

export function SuggestionLeafStatic(props: SlateLeafProps) {
  return <>{props.children}</>;
}
