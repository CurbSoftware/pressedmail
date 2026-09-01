/**
 * Semantic color mapper.
 *
 * Resolves a PaletteDefinition's semantic mapping into
 * concrete ThemeColorVariables for the CSS injection system.
 */
import type {
  PaletteDefinition,
  ScaleRef,
  SemanticColorMapping,
  ThemeColorVariables,
} from '../types/colors';
import { formatOklch, parseOklch } from './oklch';

/**
 * Resolve a single ScaleRef to a CSS oklch() string.
 */
function resolveRef(ref: ScaleRef, palette: PaletteDefinition): string {
  if ('direct' in ref) {
    return ref.direct;
  }
  const scale = ref.scale === 'base' ? palette.base : palette.primary;
  return scale[ref.stop];
}

function adjustMutedForegroundLightness(
  value: string,
  mode: 'light' | 'dark',
): string {
  const color = parseOklch(value);

  if (!color) {
    return value;
  }

  return formatOklch({
    ...color,
    l: mode === 'light' ? color.l / 2 : (color.l + 1) / 2,
  });
}

/**
 * Resolve a palette's semantic mapping into ThemeColorVariables
 * for a given mode (light or dark).
 */
export function resolveSemanticColors(
  palette: PaletteDefinition,
  mode: 'light' | 'dark',
): Pick<ThemeColorVariables, keyof SemanticColorMapping> {
  const mapping: SemanticColorMapping =
    mode === 'light'
      ? palette.semanticMapping.light
      : palette.semanticMapping.dark;

  return {
    '--background': resolveRef(mapping['--background'], palette),
    '--foreground': resolveRef(mapping['--foreground'], palette),
    '--card': resolveRef(mapping['--card'], palette),
    '--card-foreground': resolveRef(mapping['--card-foreground'], palette),
    '--popover': resolveRef(mapping['--popover'], palette),
    '--popover-foreground': resolveRef(
      mapping['--popover-foreground'],
      palette,
    ),
    '--primary': resolveRef(mapping['--primary'], palette),
    '--primary-foreground': resolveRef(
      mapping['--primary-foreground'],
      palette,
    ),
    '--secondary': resolveRef(mapping['--secondary'], palette),
    '--secondary-foreground': resolveRef(
      mapping['--secondary-foreground'],
      palette,
    ),
    '--muted': resolveRef(mapping['--muted'], palette),
    '--muted-foreground': adjustMutedForegroundLightness(
      resolveRef(mapping['--muted-foreground'], palette),
      mode,
    ),
    '--accent': resolveRef(mapping['--accent'], palette),
    '--accent-foreground': resolveRef(mapping['--accent-foreground'], palette),
    '--destructive': resolveRef(mapping['--destructive'], palette),
    '--destructive-foreground': resolveRef(
      mapping['--destructive-foreground'],
      palette,
    ),
    '--border': resolveRef(mapping['--border'], palette),
    '--input': resolveRef(mapping['--input'], palette),
    '--ring': resolveRef(mapping['--ring'], palette),
  };
}
