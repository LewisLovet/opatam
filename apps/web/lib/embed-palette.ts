/**
 * Generate a Tailwind-compatible 11-shade primary palette from a single hex input.
 *
 * Used by the embeddable widget at /p/[slug]/embed to recolor the booking UI
 * to match the host site's brand. We approximate Tailwind's shade progression
 * by keeping the input hue and saturation and varying lightness per shade.
 *
 * Returns a map { '50': '#...', '100': '#...', ..., '950': '#...' }.
 */

export type PrimaryShade =
  | '50' | '100' | '200' | '300' | '400' | '500'
  | '600' | '700' | '800' | '900' | '950';

export type PrimaryPalette = Record<PrimaryShade, string>;

/**
 * Lightness targets per shade. Mirrors the visual rhythm of Tailwind's
 * default palettes (blue/red/etc.) without copying exact values.
 */
const LIGHTNESS_STEPS: Record<PrimaryShade, number> = {
  '50': 97,
  '100': 93,
  '200': 86,
  '300': 75,
  '400': 63,
  '500': 52,
  '600': 44,
  '700': 36,
  '800': 28,
  '900': 22,
  '950': 14,
};

/**
 * Default palette (Tailwind blue) used when the input is missing or invalid.
 * Matches the CSS variables in globals.css.
 */
export const DEFAULT_PRIMARY_PALETTE: PrimaryPalette = {
  '50': '#eff6ff',
  '100': '#dbeafe',
  '200': '#bfdbfe',
  '300': '#93c5fd',
  '400': '#60a5fa',
  '500': '#3b82f6',
  '600': '#2563eb',
  '700': '#1d4ed8',
  '800': '#1e40af',
  '900': '#1e3a8a',
  '950': '#172554',
};

/** Validates a hex color (with or without leading #). Returns normalized 6-char hex without #. */
export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  let hex = input.trim().replace(/^#/, '');
  // Expand short form (e.g. F53 → FF5533)
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return hex.toLowerCase();
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }

  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const lig = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lig - c / 2;

  let r = 0;
  let g = 0;
  let bl = 0;

  if (h < 60) { r = c; g = x; bl = 0; }
  else if (h < 120) { r = x; g = c; bl = 0; }
  else if (h < 180) { r = 0; g = c; bl = x; }
  else if (h < 240) { r = 0; g = x; bl = c; }
  else if (h < 300) { r = x; g = 0; bl = c; }
  else { r = c; g = 0; bl = x; }

  const toHex = (n: number): string => {
    const v = Math.round((n + m) * 255);
    return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  };

  return '#' + toHex(r) + toHex(g) + toHex(bl);
}

/**
 * Generate the full 11-shade palette from a single hex color.
 * If the hex is invalid, returns DEFAULT_PRIMARY_PALETTE.
 */
export function generatePrimaryPalette(input: string | null | undefined): PrimaryPalette {
  const hex = normalizeHex(input);
  if (!hex) return DEFAULT_PRIMARY_PALETTE;

  const { h, s } = hexToHsl(hex);
  const result = {} as PrimaryPalette;

  for (const shade of Object.keys(LIGHTNESS_STEPS) as PrimaryShade[]) {
    const l = LIGHTNESS_STEPS[shade];
    // Slightly desaturate very light shades so they don't look like pastel clown vomit
    const adjustedS = l > 85 ? Math.min(s, 55) : s;
    result[shade] = hslToHex(h, adjustedS, l);
  }

  return result;
}

/**
 * Build the CSS string that overrides the --color-primary-* variables.
 * Meant to be injected via <style> tag in the embed page.
 */
export function paletteToCss(palette: PrimaryPalette): string {
  const lines = (Object.keys(palette) as PrimaryShade[])
    .map((shade) => `  --color-primary-${shade}: ${palette[shade]};`)
    .join('\n');
  return `:root {\n${lines}\n}`;
}
