/**
 * Static (server-safe) node components for the PressedMail custom nodes.
 *
 * Plate's `serializeHtml` (from `platejs/static`) renders each node through its
 * registered React `node.component`, it does NOT consult the legacy
 * `parsers.html.serializer.parse` path. Without a static component the custom
 * `pm_*` nodes serialize to bare <div>/<span> and lose the `data-pm-*` HTML
 * contract that downstream email parsing/round-tripping relies on.
 *
 * These components re-emit that contract via SlateElement's `attributes`.
 * They mirror the opening tags produced by each plugin's legacy serializer:
 *   signature   → <div  data-pm-block="signature" data-account-id data-signature-id>
 *   quote       → <blockquote data-pm-block="quote" data-collapsed data-source-*>
 *   attachment  → <span data-pm-block="attachment" data-filename data-size data-attachment-id>
 *   ai-suggestion → <span data-pm-block="ai-suggestion" data-accepted data-suggestion-id>
 */

import type { SlateElementProps } from '@kit/plate/static';
import { SlateElement } from '@kit/plate/static';

import type { AISuggestionElement } from './ai-suggestion-node';
import type { AttachmentCardElement } from './attachment-card-node';
import type { QuoteElement } from './quote-node';
import type { SignatureElement } from './signature-node';

export function SignatureElementStatic(props: SlateElementProps) {
  const el = props.element as SignatureElement;

  return (
    <SlateElement
      {...props}
      as="div"
      attributes={{
        ...props.attributes,
        'data-pm-block': 'signature',
        ...(el.accountId != null
          ? { 'data-account-id': String(el.accountId) }
          : {}),
        ...(el.signatureId != null
          ? { 'data-signature-id': String(el.signatureId) }
          : {}),
      }}
    >
      {props.children}
    </SlateElement>
  );
}

export function QuoteElementStatic(props: SlateElementProps) {
  const el = props.element as QuoteElement;

  return (
    <SlateElement
      {...props}
      as="blockquote"
      attributes={{
        ...props.attributes,
        'data-pm-block': 'quote',
        'data-collapsed': el.collapsed ? 'true' : 'false',
        ...(el.sourceFrom ? { 'data-source-from': String(el.sourceFrom) } : {}),
        ...(el.sourceDate ? { 'data-source-date': String(el.sourceDate) } : {}),
        ...(el.sourceMessageId
          ? { 'data-source-message-id': String(el.sourceMessageId) }
          : {}),
      }}
    >
      {props.children}
    </SlateElement>
  );
}

export function AttachmentCardElementStatic(props: SlateElementProps) {
  const el = props.element as AttachmentCardElement;

  return (
    <SlateElement
      {...props}
      as="span"
      attributes={{
        ...props.attributes,
        'data-pm-block': 'attachment',
        ...(el.filename ? { 'data-filename': String(el.filename) } : {}),
        ...(el.size ? { 'data-size': String(el.size) } : {}),
        ...(el.id ? { 'data-attachment-id': String(el.id) } : {}),
      }}
    >
      {el.filename || 'attachment'}
      {props.children}
    </SlateElement>
  );
}

export function AISuggestionElementStatic(props: SlateElementProps) {
  const el = props.element as AISuggestionElement;

  return (
    <SlateElement
      {...props}
      as="span"
      attributes={{
        ...props.attributes,
        'data-pm-block': 'ai-suggestion',
        ...(el.accepted != null
          ? { 'data-accepted': String(el.accepted) }
          : {}),
        ...(el.suggestionId
          ? { 'data-suggestion-id': String(el.suggestionId) }
          : {}),
      }}
    >
      {props.children}
    </SlateElement>
  );
}
