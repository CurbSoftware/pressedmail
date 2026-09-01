import type { UmamiEventName } from './events';
import { UMAMI_MAX_STRING_LENGTH } from './props';

/**
 * Build the declarative `data-umami-event*` attributes for a clickable element.
 * Umami converts each `data-umami-event-<key>` into event data on click, and
 * walks up from the click target, so the attributes may sit on a wrapper.
 *
 * Everything arrives at Umami as a string via this path, use
 * `trackUmamiEvent()` when a numeric or boolean property matters.
 *
 * Keys should be kebab-case to match the property names the rest of the
 * vocabulary uses; camelCase keys are converted, since React would otherwise
 * emit `data-umami-event-navlabel` and quietly create a second column.
 *
 * @example
 * <a {...umamiClick(UMAMI_EVENTS.navLinkClicked, { 'nav-target': '/features' })}>
 */
export function umamiClick(
  event: UmamiEventName,
  data?: Record<string, string | number | boolean | undefined | null>,
): Record<string, string> {
  const attrs: Record<string, string> = { 'data-umami-event': event };

  if (data) {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }

      attrs[`data-umami-event-${toKebabCase(key)}`] = String(value).slice(
        0,
        UMAMI_MAX_STRING_LENGTH,
      );
    }
  }

  return attrs;
}

function toKebabCase(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}
