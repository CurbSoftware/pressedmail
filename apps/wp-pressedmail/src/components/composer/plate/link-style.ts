import type { CSSProperties } from 'react';
import type { SlateEditor } from '@kit/plate';
import { BaseLinkPlugin, validateUrl } from '@kit/plate/link';

// Email buttons are ordinary anchors with inline presentation. Keep their
// styles on the link itself so insertion, editing and sending use one shape.
const LINK_STYLE_PROPERTIES = [
  'display', 'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'backgroundColor', 'color', 'textDecoration', 'borderRadius',
] as const;

/** CSSOM expands hex to RGB; native WordPress KSES rejects these functions. */
export function normalizeComposerLinkColor(value: string): string {
  const rgb = /^rgb(a?)\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*(?:,\s*((?:\d+(?:\.\d+)?|\.\d+))\s*)?\)$/i.exec(value.trim());
  if (!rgb || Boolean(rgb[1]) !== (rgb[5] !== undefined)) return value;
  const channels = rgb.slice(2, 5).map(Number);
  if (channels.some((channel) => channel > 255)) return value;
  const alpha = rgb[5] === undefined ? 1 : Number(rgb[5]);
  if (alpha > 1) return value;
  const hex = channels.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('');
  return `#${hex}${alpha < 1 ? Math.round(alpha * 255).toString(16).padStart(2, '0') : ''}`;
}

export function getComposerLinkStyle(value: unknown): CSSProperties {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const style: Record<string, string> = {};
  for (const property of LINK_STYLE_PROPERTIES) {
    const authored = source[property];
    // No stylesheet declarations, external resources or unresolved CSS values
    // can be smuggled into a serialized link through stored document metadata.
    if (typeof authored === 'string' && authored && !/[;<>]|(?:url|expression|var)\s*\(/i.test(authored)) {
      style[property] = property === 'color' || property === 'backgroundColor'
        ? normalizeComposerLinkColor(authored)
        : authored;
    }
  }
  return style as CSSProperties;
}

export function readComposerLinkStyle(element: HTMLElement) {
  const style = getComposerLinkStyle(Object.fromEntries(
    LINK_STYLE_PROPERTIES.map((property) => [property, element.style[property]]),
  ));
  return Object.keys(style).length ? { linkStyle: style } : {};
}

/** Retain Plate's URL validation while preserving authored email presentation. */
export function parseComposerLink(element: HTMLElement, editor: SlateEditor, type: string) {
  const url = element.getAttribute('href');
  if (!url || !validateUrl(editor, url)) return;
  return { target: element.getAttribute('target') || '_blank', type, url, ...readComposerLinkStyle(element) };
}

export const ComposerLinkPlugin = BaseLinkPlugin.configure({
  parsers: { html: { deserializer: {
    rules: [{ validNodeName: 'A' }],
    parse: ({ element, editor, type }) => parseComposerLink(element, editor, type),
  } } },
});
