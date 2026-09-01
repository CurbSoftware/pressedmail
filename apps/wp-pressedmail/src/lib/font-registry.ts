export type PressedMailFontCategory =
  | "system"
  | "sans-serif"
  | "serif"
  | "monospace"
  | "accessibility";

export interface PressedMailFontOption {
  id: string;
  label: string;
  category: PressedMailFontCategory;
  cssFontFamily: string | null;
  uiSafe: boolean;
  composerSafe: boolean;
  isAccessibilityFont?: boolean;
  description: string;
}

const WIRED_FONT_STACK =
  '"Wired", "Trebuchet MS", "Lucida Grande", "Lucida Sans Unicode", "Lucida Sans", Tahoma, sans-serif';

const FONT_OPTIONS: PressedMailFontOption[] = [
  {
    id: "default",
    label: "Default",
    category: "system",
    cssFontFamily: null,
    uiSafe: false,
    composerSafe: true,
    description: "Use the current default font.",
  },
  {
    id: "wired",
    label: "Wired",
    category: "accessibility",
    cssFontFamily: WIRED_FONT_STACK,
    uiSafe: true,
    composerSafe: true,
    isAccessibilityFont: true,
    description: "Dyslexia-friendly font option.",
  },
  {
    id: "system-ui",
    label: "System UI",
    category: "system",
    cssFontFamily: "system-ui, sans-serif",
    uiSafe: true,
    composerSafe: true,
    description: "Native operating system UI font.",
  },
  {
    id: "sans-serif",
    label: "Sans Serif",
    category: "sans-serif",
    cssFontFamily: "Arial, Helvetica, sans-serif",
    uiSafe: false,
    composerSafe: true,
    description: "Email-compatible generic sans-serif stack.",
  },
  {
    id: "neo-grotesque-sans",
    label: "Neo-Grotesque Sans",
    category: "sans-serif",
    cssFontFamily:
      "Inter, Roboto, 'Helvetica Neue', 'Arial Nova', 'Nimbus Sans', Arial, sans-serif",
    uiSafe: true,
    composerSafe: true,
    description: "Clean modern sans-serif stack.",
  },
  {
    id: "humanist-sans",
    label: "Humanist Sans",
    category: "sans-serif",
    cssFontFamily:
      "Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', source-sans-pro, sans-serif",
    uiSafe: true,
    composerSafe: true,
    description: "Readable, friendly sans-serif stack.",
  },
  {
    id: "geometric-sans",
    label: "Geometric Sans",
    category: "sans-serif",
    cssFontFamily:
      "Avenir, Montserrat, Corbel, 'URW Gothic', source-sans-pro, sans-serif",
    uiSafe: true,
    composerSafe: false,
    description: "Modern geometric sans-serif style.",
  },
  {
    id: "classical-sans",
    label: "Classical Sans",
    category: "sans-serif",
    cssFontFamily: "Optima, Candara, 'Noto Sans', source-sans-pro, sans-serif",
    uiSafe: true,
    composerSafe: false,
    description: "Elegant humanist sans-serif stack.",
  },
  {
    id: "rounded-sans",
    label: "Rounded Sans",
    category: "sans-serif",
    cssFontFamily:
      "ui-rounded, 'Hiragino Maru Gothic ProN', Quicksand, Comfortaa, Manjari, 'Arial Rounded MT', 'Arial Rounded MT Bold', Calibri, source-sans-pro, sans-serif",
    uiSafe: true,
    composerSafe: false,
    description: "Softer rounded sans-serif style.",
  },
  {
    id: "editorial-serif",
    label: "Editorial Serif",
    category: "serif",
    cssFontFamily: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, serif",
    uiSafe: true,
    composerSafe: true,
    description: "Readable serif stack for long-form writing.",
  },
  {
    id: "serif",
    label: "Serif",
    category: "serif",
    cssFontFamily: "Georgia, 'Times New Roman', Times, serif",
    uiSafe: false,
    composerSafe: true,
    description: "Email-compatible generic serif stack.",
  },
  {
    id: "old-style-serif",
    label: "Old Style Serif",
    category: "serif",
    cssFontFamily:
      "'Iowan Old Style', 'Palatino Linotype', 'URW Palladio L', P052, serif",
    uiSafe: true,
    composerSafe: false,
    description: "Classic book-style serif stack.",
  },
  {
    id: "slab-serif",
    label: "Slab Serif",
    category: "serif",
    cssFontFamily:
      "Rockwell, 'Rockwell Nova', 'Roboto Slab', 'DejaVu Serif', 'Sitka Small', serif",
    uiSafe: true,
    composerSafe: false,
    description: "Strong slab-style serif stack.",
  },
  {
    id: "monospace-code",
    label: "Monospace Code",
    category: "monospace",
    cssFontFamily:
      "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
    uiSafe: true,
    composerSafe: true,
    description: "Readable code/editor-style monospace stack.",
  },
  {
    id: "monospace-typewriter",
    label: "Monospace Typewriter",
    category: "monospace",
    cssFontFamily: "'Nimbus Mono PS', 'Courier New', monospace",
    uiSafe: true,
    composerSafe: true,
    description: "Traditional typewriter-style monospace stack.",
  },
];

const OPTION_BY_ID = new Map(FONT_OPTIONS.map((option) => [option.id, option]));

const UI_FONT_IDS = [
  "system-ui",
  "neo-grotesque-sans",
  "humanist-sans",
  "geometric-sans",
  "classical-sans",
  "rounded-sans",
  "editorial-serif",
  "old-style-serif",
  "slab-serif",
  "monospace-code",
  "monospace-typewriter",
  "wired",
] as const;

const COMPOSER_FONT_IDS = [
  "default",
  "system-ui",
  "sans-serif",
  "humanist-sans",
  "neo-grotesque-sans",
  "editorial-serif",
  "serif",
  "monospace-code",
  "monospace-typewriter",
  "wired",
] as const;

const UI_FONT_ALIASES: Record<string, string> = {
  opendyslexic: "wired",
  "wired-opendyslexic": "wired",
  "modern-native": "system-ui",
  "friendly-clear": "humanist-sans",
  humanist: "humanist-sans",
  editorial: "editorial-serif",
  serif: "editorial-serif",
  mono: "monospace-code",
};

const COMPOSER_FONT_ALIASES: Record<string, string> = {
  opendyslexic: "wired",
  "wired-opendyslexic": "wired",
  "modern-native": "system-ui",
  "friendly-clear": "humanist-sans",
  humanist: "humanist-sans",
  editorial: "editorial-serif",
  sans: "sans-serif",
  mono: "monospace-code",
};

const LEGACY_COMPOSER_FAMILY_ALIASES: Record<string, string> = {
  "arial,sans-serif": "sans-serif",
  "georgia,serif": "serif",
  "menlo,consolas,monospace": "monospace-code",
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeFontFamily(value: string): string {
  return value
    .trim()
    .replace(/;\s*$/, "")
    .replace(/["']/g, "")
    .replace(/\s*,\s*/g, ",")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getOptions(ids: readonly string[]): PressedMailFontOption[] {
  return ids.flatMap((id) => {
    const option = OPTION_BY_ID.get(id);
    return option ? [option] : [];
  });
}

function resolveFontOption(
  value: string | null | undefined,
  aliases: Record<string, string>,
  predicate: (option: PressedMailFontOption) => boolean,
): PressedMailFontOption | null {
  if (!value) return null;

  const normalized = normalizeToken(value);
  const aliasedId = aliases[normalized];
  if (aliasedId) {
    const aliased = OPTION_BY_ID.get(aliasedId);
    if (aliased && predicate(aliased)) return aliased;
  }

  const direct = OPTION_BY_ID.get(normalized);
  if (direct && predicate(direct)) return direct;

  return null;
}

export function getUiFontOptions(): PressedMailFontOption[] {
  return getOptions(UI_FONT_IDS).filter((option) => option.uiSafe);
}

export function getComposerFontOptions(): PressedMailFontOption[] {
  return getOptions(COMPOSER_FONT_IDS).filter((option) => option.composerSafe);
}

export function resolveUiFontOption(
  value: string | null | undefined,
): PressedMailFontOption | null {
  return resolveFontOption(value, UI_FONT_ALIASES, (option) => option.uiSafe);
}

export function resolveComposerFontOption(
  value: string | null | undefined,
): PressedMailFontOption | null {
  return resolveFontOption(
    value,
    COMPOSER_FONT_ALIASES,
    (option) => option.composerSafe,
  );
}

export function resolveComposerFontOptionFromFamily(
  value: string | null | undefined,
): PressedMailFontOption | null {
  if (!value) return null;

  const normalized = normalizeFontFamily(value);
  const legacyId = LEGACY_COMPOSER_FAMILY_ALIASES[normalized];
  if (legacyId) return resolveComposerFontOption(legacyId);

  return (
    getComposerFontOptions().find(
      (option) =>
        option.cssFontFamily &&
        normalizeFontFamily(option.cssFontFamily) === normalized,
    ) ?? null
  );
}

export function isApprovedComposerFontFamily(
  value: string | null | undefined,
): boolean {
  return Boolean(resolveComposerFontOptionFromFamily(value));
}

export function sanitizeComposerFontFamily(
  value: string | null | undefined,
): string | undefined {
  return resolveComposerFontOptionFromFamily(value)?.cssFontFamily ?? undefined;
}
