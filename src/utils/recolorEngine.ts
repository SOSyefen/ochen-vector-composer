import { ColorRole, Palette, PaletteRoles } from '../types';

export function normalizeHex(color: string): string {
  const trimmed = color.trim().toUpperCase();
  if (trimmed === 'WHITE') return '#FFFFFF';
  if (trimmed === 'BLACK') return '#000000';
  if (/^#[0-9A-F]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  return trimmed;
}

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

export const BUILTIN_PALETTES: Palette[] = [
  {
    id: 'lavender',
    name: 'Lavender / Лаванда',
    roles: {
      bg: '#D7CDF5',
      primary_accent: '#AA9BF0',
      secondary_accent: '#7864D7',
      highlight: '#F9ECB0',
      tertiary_accent: '#F9A3AA',
      soft_fill: '#FFE3E1',
      stroke: '#181817',
      white: '#FFFFFF',
    },
  },
  {
    id: 'sand',
    name: 'Sand & Peach / Песок',
    roles: {
      bg: '#FDD7B9',
      primary_accent: '#FAC896',
      secondary_accent: '#D27532',
      highlight: '#F9ECB0',
      tertiary_accent: '#80DADA',
      soft_fill: '#BEEBEB',
      stroke: '#181817',
      white: '#FFFFFF',
    },
  },
  {
    id: 'mint',
    name: 'Mint & Teal / Мята',
    roles: {
      bg: '#BEEBEB',
      primary_accent: '#80DADA',
      secondary_accent: '#5ABEBE',
      highlight: '#FFD4F2',
      tertiary_accent: '#6D7BFC',
      soft_fill: '#B6C6FE',
      stroke: '#181817',
      white: '#FFFFFF',
    },
  },
];

export function isAllowedCanvasBg(hexCandidate: string, activePalette?: Palette): boolean {
  const hex = normalizeHex(hexCandidate);
  if (APPROVED_SYSTEM_BACKGROUNDS.has(hex)) return true;
  if (FORBIDDEN_CANVAS_BG_COLORS.has(hex)) return false;

  if (activePalette) {
    const paletteBg = normalizeHex(activePalette.roles.bg);
    if (hex === paletteBg) return true;
  }
  return true;
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

// Map base SVG colors (Lavender) to logical roles
const SOURCE_COLOR_ROLES: Record<string, ColorRole> = {
  '#D7CDF5': 'bg',
  '#AA9BF0': 'primary_accent',
  '#7864D7': 'secondary_accent',
  '#F9ECB0': 'highlight',
  '#F9A3AA': 'tertiary_accent',
  '#FFE3E1': 'soft_fill',
  '#181817': 'stroke',
  '#FFFFFF': 'white',
  'WHITE': 'white',
};

export function scopeSvgIds(svgContent: string, prefix: string): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_');
  const ids: string[] = [];
  const idRegex = /\bid=["']([^"']+)["']/g;
  let match;
  while ((match = idRegex.exec(svgContent)) !== null) {
    ids.push(match[1]);
  }

  let result = svgContent;
  for (const id of ids) {
    const newId = `${safePrefix}_${id}`;
    result = result.replaceAll(`id="${id}"`, `id="${newId}"`);
    result = result.replaceAll(`url(#${id})`, `url(#${newId})`);
    result = result.replaceAll(`href="#${id}"`, `href="#${newId}"`);
  }
  return result;
}

export function recolorSvg(rawSvg: string, palette: Palette, instanceId?: string): string {
  let content = instanceId ? scopeSvgIds(rawSvg, instanceId) : rawSvg;

  // Replace colors according to palette roles
  for (const [sourceColor, role] of Object.entries(SOURCE_COLOR_ROLES)) {
    const targetColor = palette.roles[role];
    if (!targetColor) continue;

    // Replace fill="SOURCE" or stroke="SOURCE"
    const fillRegex = new RegExp(`fill=["']${sourceColor}["']`, 'gi');
    content = content.replace(fillRegex, `fill="${targetColor}"`);

    const strokeRegex = new RegExp(`stroke=["']${sourceColor}["']`, 'gi');
    content = content.replace(strokeRegex, `stroke="${targetColor}"`);

    const styleRegex = new RegExp(`(:\\s*)${sourceColor}([;"])`, 'gi');
    content = content.replace(styleRegex, `$1${targetColor}$2`);
  }

  return content;
}
