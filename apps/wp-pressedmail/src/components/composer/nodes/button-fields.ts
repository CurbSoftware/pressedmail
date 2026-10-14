/**
 * The Insert button block: its settings, the checks every one of them passes,
 * and the email markup they become.
 *
 * A button is a table with one coloured cell, because that is the shape that
 * holds its size in Outlook for desktop: Word's engine ignores padding and
 * `display` on a link, but it honours padding and `bgcolor` on a `td`. So the
 * padding and fill sit on the cell, and the link inside carries only its colour
 * and weight.
 *
 *   <table data-pm-block="button" [width="100%" | align="center|right"] style="border-collapse:separate">
 *     <td bgcolor style="background-color;padding;border-radius">
 *       <a href style="color;font-weight;text-decoration:none">label</a>
 *
 * The markup is written in two places, React for the Pro serializer and the live
 * editor, and a string for the Free serializer. Both are built from `buttonParts`
 * so they cannot drift, and a node edited by hand is checked again here on the way
 * out. Nothing here may import from the templates code: Free ships this file.
 */

import { isHexColor } from "@/lib/hex-color";
import { isTemplateToken } from "@/lib/merge-fields";

export const BUTTON_KEY = "pm_button";
/** The `data-pm-block` value, which is what a reopened draft is read back by. */
export const BUTTON_BLOCK = "button";

export const BUTTON_DEFAULT_BACKGROUND = "#2563eb";
export const BUTTON_DEFAULT_TEXT = "#ffffff";
export const BUTTON_LABEL_MAX = 200;

export const BUTTON_WIDTHS = ["fit", "full"] as const;
export const BUTTON_ALIGNS = ["left", "center", "right"] as const;
export type ButtonWidth = (typeof BUTTON_WIDTHS)[number];
export type ButtonAlign = (typeof BUTTON_ALIGNS)[number];

export interface ButtonSettings {
  label: string;
  url: string;
  /** Not `backgroundColor`: that key is the font-background mark, which Plate would inject as a style. */
  buttonColor: string;
  textColor: string;
  width: ButtonWidth;
  /** Where a fit-width button sits on its line. A full-width one has no room to move. */
  align: ButtonAlign;
}

/** `#rrggbb` in lower case (a short `#rgb` is widened), or the fallback. */
export function cleanHexColor(value: unknown, fallback: string): string {
  const color = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!isHexColor(color)) return fallback;
  if (color.length === 7) return color;
  if (color.length === 4) return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  return fallback;
}

/**
 * An http(s), mailto or tel address, a whole merge field, or '' for anything
 * else (javascript:, relative, junk, a field in the middle of an address).
 * A field is whatever the template grammar reads as one, so a field the server
 * would not fill is refused. Quotes and angle brackets are refused: the static
 * serializer decodes entities after rendering, so they would break out of the
 * attribute. A quote or an ampersand in a field's fallback is refused for the same reason.
 */
export function cleanButtonUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const url = value.trim();
  if (isTemplateToken(url)) return /["&]/.test(url) ? "" : url;
  // Braces are not part of an address; a field is the whole address or nothing.
  if (/\{\{|\}\}/.test(url)) return "";
  if (/^(?:mailto|tel):[^\s<>"]+$/i.test(url)) return url;
  if (!/^https?:\/\/[^\s<>"]+$/i.test(url)) return "";
  try {
    return new URL(url).protocol.startsWith("http") ? url : "";
  } catch {
    return "";
  }
}

/** One line of text without the characters that would turn into markup. */
export function cleanButtonLabel(value: unknown, max = BUTTON_LABEL_MAX): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/[<>"]/g, "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max).trim() : text;
}

/** Anything a button's settings can be read from: a node, a parsed element, a half-filled form. */
export type ButtonInput = object;

export function normalizeButton(input: ButtonInput = {}): ButtonSettings {
  const patch = input as Partial<Record<keyof ButtonSettings, unknown>>;
  return {
    label: cleanButtonLabel(patch.label),
    url: cleanButtonUrl(patch.url),
    buttonColor: cleanHexColor(patch.buttonColor, BUTTON_DEFAULT_BACKGROUND),
    textColor: cleanHexColor(patch.textColor, BUTTON_DEFAULT_TEXT),
    width: patch.width === "full" ? "full" : "fit",
    align: BUTTON_ALIGNS.find((align) => align === patch.align) ?? "left",
  };
}

type Declarations = Array<[property: string, value: string]>;

export interface ButtonParts {
  label: string;
  tableAttributes: {
    role: "presentation";
    "data-pm-block": typeof BUTTON_BLOCK;
    cellpadding: "0";
    cellspacing: "0";
    border: "0";
    width?: "100%";
    align?: "center" | "right";
  };
  tableStyle: Declarations;
  cellAttributes: { align: "center"; bgcolor: string };
  cellStyle: Declarations;
  linkAttributes: { href?: string };
  linkStyle: Declarations;
}

/** Everything the email markup says, with every setting checked again. */
export function buttonParts(element: ButtonInput): ButtonParts {
  const button = normalizeButton(element);
  const full = button.width === "full";
  return {
    label: button.label,
    tableAttributes: {
      role: "presentation",
      "data-pm-block": BUTTON_BLOCK,
      cellpadding: "0",
      cellspacing: "0",
      border: "0",
      ...(full ? { width: "100%" as const } : button.align === "left" ? {} : { align: button.align }),
    },
    // A collapsed table drops the cell's rounded corners, and both the send
    // step and the editor's base styles collapse every table that does not say otherwise.
    tableStyle: [["border-collapse", "separate"]],
    cellAttributes: { align: "center", bgcolor: button.buttonColor },
    cellStyle: [
      ["background-color", button.buttonColor],
      // The send step gives a table cell a grey border and 8px of padding unless
      // the cell says otherwise.
      ["border", "0"],
      ["border-radius", "6px"],
      ["padding", "12px 24px"],
      ["text-align", "center"],
    ],
    linkAttributes: button.url ? { href: button.url } : {},
    linkStyle: [
      ["color", button.textColor],
      ["display", full ? "block" : "inline-block"],
      ["font-weight", "bold"],
      ["text-decoration", "none"],
    ],
  };
}

const camel = (property: string) => property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());

/** The same declarations as a React style object. */
export function declarationsToStyle(declarations: Declarations): Record<string, string> {
  return Object.fromEntries(declarations.map(([property, value]) => [camel(property), value]));
}

const escapeText = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

function attributes(values: object, style: Declarations): string {
  const entries = Object.entries(values as Record<string, string>).map(
    ([name, value]) => ` ${name}="${escapeText(value)}"`,
  );
  if (style.length) {
    entries.push(` style="${escapeText(style.map(([property, value]) => `${property}:${value}`).join(";"))}"`);
  }
  return entries.join("");
}

/** The button as one HTML string, for the Free serializer. */
export function buttonHtml(element: ButtonInput): string {
  const parts = buttonParts(element);
  return (
    `<table${attributes(parts.tableAttributes, parts.tableStyle)}><tbody><tr>` +
    `<td${attributes(parts.cellAttributes, parts.cellStyle)}>` +
    `<a${attributes(parts.linkAttributes, parts.linkStyle)}>${escapeText(parts.label)}</a>` +
    `</td></tr></tbody></table>`
  );
}

/** A colour out of an inline style attribute as written, not as the DOM recomputes it (`rgb(...)`). */
function styleColor(style: string | null | undefined, property: string): string {
  const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*(#\\w+)`, "i").exec(style ?? "");
  return match?.[1] ?? "";
}

/** The settings a button's markup holds, read from a reopened draft, a paste or an import. Anything outside the shape is dropped. */
export function readButtonSettings(table: HTMLElement): ButtonSettings {
  const link = table.querySelector("a");
  const cell = table.querySelector("td");
  return normalizeButton({
    label: link?.textContent ?? "",
    url: link?.getAttribute("href") ?? "",
    buttonColor: styleColor(cell?.getAttribute("style"), "background-color") || cell?.getAttribute("bgcolor"),
    textColor: styleColor(link?.getAttribute("style"), "color"),
    width: table.getAttribute("width") === "100%" ? "full" : "fit",
    align: table.getAttribute("align"),
  });
}
