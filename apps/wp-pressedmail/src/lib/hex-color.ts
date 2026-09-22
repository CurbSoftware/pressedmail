const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** `#abc`, `#aabbcc` or `#aabbccdd`, any case. The one hex check for the plugin. */
export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}
