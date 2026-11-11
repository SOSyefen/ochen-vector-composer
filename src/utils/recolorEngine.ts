import { ObjectVariant, Palette, PaletteRoles } from '../types';
import { normalizeHex, recolorSvgPure, scopeSvgIds } from '../engine/pipeline/4-svgCompiler';
import { BUILTIN_PALETTES } from '../engine/catalog';

/** Чистые SVG-утилиты и встроенные палитры живут в ядре (ZERO-DOM); реэкспорт для обратной совместимости. */
export { normalizeHex, scopeSvgIds, BUILTIN_PALETTES };

export const APPROVED_SYSTEM_BACKGROUNDS: ReadonlySet<string> = new Set<string>([
  '#D7CDF5', // Lavender
  '#FDD7B9', // Sand/Peach
  '#BEEBEB', // Mint
  '#FFFFFF', // Clean white
]);

export const FORBIDDEN_CANVAS_BG_COLORS: ReadonlySet<string> = new Set<string>([
  '#181817', // Black outline
  '#AA9BF0', // Lavender accent
  '#7864D7', // Purple accent
  '#F9ECB0', // Yellow accent
  '#F9A3AA', // Coral accent
  '#FFE3E1', // Rose fill
  '#FAC896', // Sand accent
  '#D27532', // Rust/Orange accent
  '#80DADA', // Teal accent
  '#5ABEBE', // Deep mint
  '#FFD4F2', // Pink accent
  '#6D7BFC', // Periwinkle accent
  '#B6C6FE', // Light blue
]);

export function isAllowedCanvasBg(hexCandidate: string, activePalette?: Palette): boolean {
  const hex = normalizeHex(hexCandidate);

  if (APPROVED_SYSTEM_BACKGROUNDS.has(hex)) return true;

  if (activePalette && hex === normalizeHex(activePalette.roles.bg)) {
    return !FORBIDDEN_CANVAS_BG_COLORS.has(hex);
  }

  return false;
}

export function validatePalette(roles: PaletteRoles): { valid: boolean; error?: string } {
  const normalizedBg = normalizeHex(roles.bg);
  if (FORBIDDEN_CANVAS_BG_COLORS.has(normalizedBg)) {
    return {
      valid: false,
      error: `Цвет ${normalizedBg} принадлежит палитре объектов и запрещён в качестве фона холста.`,
    };
  }
  return { valid: true };
}

/**
 * Перекраска SVG под палитру + scoping id.
 * Делегирует в чистое ядро (engine/pipeline/4-svgCompiler).
 */
export function recolorSvg(
  rawSvg: string,
  palette: Palette,
  instanceId?: string,
  variant?: ObjectVariant
): string {
  return recolorSvgPure(rawSvg, palette, instanceId, variant);
}
