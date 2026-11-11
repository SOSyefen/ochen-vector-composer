/**
 * Шаг 4 пайплайна (опциональный): headless-компиляция сцены в итоговый SVG.
 * ZERO-DOM: только строковые операции, без document / DOMParser / window.
 */
import { CANVAS_FORMATS } from '../../types';
import type {
  CanvasObject,
  ColorRole,
  DetailSize,
  IllustrationId,
  ObjectVariant,
  Palette,
  PaletteRoles,
} from '../../types';
import type { SvgCompileOptions } from '../contracts';

// ---- Constants -------------------------------------------------------------

/**
 * Эталонная палитра, в которой нарисованы исходные ассеты.
 * Цвета ассетов сопоставляются ролям по этому словарю.
 */
export const REFERENCE_PALETTE_ROLES: Readonly<PaletteRoles> = {
  bg: '#D7CDF5',
  primary_accent: '#AA9BF0',
  secondary_accent: '#7864D7',
  highlight: '#F9ECB0',
  tertiary_accent: '#F9A3AA',
  soft_fill: '#FFE3E1',
  stroke: '#181817',
  white: '#FFFFFF',
};

/** Порядок приоритета ролей при совпадении исходных цветов (первая побеждает) */
const ROLE_ORDER: readonly ColorRole[] = [
  'stroke',
  'white',
  'primary_accent',
  'secondary_accent',
  'highlight',
  'tertiary_accent',
  'soft_fill',
  'bg',
];

/** Монохромная политика для варианта "Bg": акцентные роли сводятся к primary_accent */
const BG_VARIANT_ROLE_COLLAPSE: Readonly<Partial<Record<ColorRole, ColorRole>>> = {
  secondary_accent: 'primary_accent',
  highlight: 'primary_accent',
  tertiary_accent: 'primary_accent',
};

/** Атрибуты корневого <svg> ассета, которые наследуются содержимым и должны сохраниться */
const INHERITED_ROOT_ATTRS: ReadonlySet<string> = new Set<string>([
  'fill',
  'fill-rule',
  'clip-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'opacity',
  'style',
]);

/** Заглушка для отсутствующих ассетов (цвета будут перекрашены под палитру) */
export const FALLBACK_PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<rect x="4" y="4" width="92" height="92" rx="12" fill="#FFFFFF" stroke="#181817" stroke-width="3" stroke-dasharray="8 6"/>' +
  '<path d="M30 30 L70 70 M70 30 L30 70" stroke="#181817" stroke-width="3" stroke-linecap="round"/>' +
  '</svg>';

const COLOR_DECL_REGEX =
  /((?:fill|stroke|stop-color|flood-color|lighting-color|color)\s*(?:=\s*["']?\s*|:\s*))(#[0-9a-fA-F]{8}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3,4})(?![0-9a-fA-F])/gi;

// ---- Types -----------------------------------------------------------------

export interface SvgViewBoxMetrics {
  minX: number;
  minY: number;
  vbWidth: number;
  vbHeight: number;
}

export interface CompileFullSvgExtras {
  palette?: Palette;
  dimensions?: { width: number; height: number };
}

// ---- Helpers ---------------------------------------------------------------

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmt(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toFixed(3))) : '0';
}

function sanitizeScope(scope: string): string {
  return scope.replace(/[^A-Za-z0-9_-]/g, '_');
}

function resolvePaletteRoles(palette: Palette | PaletteRoles): PaletteRoles {
  return 'roles' in palette ? palette.roles : palette;
}

// ---- Public API ------------------------------------------------------------

export function buildSvgRawKey(id: IllustrationId, size: DetailSize, variant: ObjectVariant): string {
  return `${id}_${size}_${variant}`;
}

/** '#abc' | 'aabbcc' | '#AaBbCc' -> '#AABBCC'. Невалидные значения: trim + upper case. */
export function normalizeHex(value: string): string {
  const source = String(value ?? '').trim();
  const raw = source.replace(/^#/, '');
  if (/^[0-9a-fA-F]{3,4}$/.test(raw)) {
    return `#${raw
      .split('')
      .map((c) => c + c)
      .join('')}`.toUpperCase();
  }
  if (/^(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(raw)) {
    return `#${raw}`.toUpperCase();
  }
  return source.toUpperCase();
}

/**
 * Префиксует все id внутри SVG и обновляет ссылки url(#id), href="#id", xlink:href="#id".
 * Нужен, чтобы несколько экземпляров одного ассета не конфликтовали градиентами/масками.
 */
export function scopeSvgIds(svg: string, scope: string): string {
  if (!svg || !scope) return svg;
  const ids = new Set<string>();
  const idRegex = /\sid\s*=\s*(["'])([^"']*)\1/g;
  let match: RegExpExecArray | null;
  while ((match = idRegex.exec(svg)) !== null) {
    if (match[2]) ids.add(match[2]);
  }
  if (ids.size === 0) return svg;

  const prefix = `${sanitizeScope(scope)}-`;
  return svg
    .replace(/(\s)id\s*=\s*(["'])([^"']*)\2/g, (m: string, ws: string, q: string, id: string) =>
      ids.has(id) ? `${ws}id=${q}${prefix}${id}${q}` : m
    )
    .replace(/url\(\s*(["']?)#([^"')\s]+)\1\s*\)/g, (m: string, q: string, id: string) =>
      ids.has(id) ? `url(${q}#${prefix}${id}${q})` : m
    )
    .replace(/((?:xlink:)?href\s*=\s*)(["'])#([^"']+)\2/g, (m: string, attr: string, q: string, id: string) =>
      ids.has(id) ? `${attr}${q}#${prefix}${id}${q}` : m
    );
}

function buildColorMap(roles: PaletteRoles, variant: ObjectVariant): Map<string, string> {
  const map = new Map<string, string>();
  for (const role of ROLE_ORDER) {
    const source = normalizeHex(REFERENCE_PALETTE_ROLES[role]);
    if (map.has(source)) continue;
    const targetRole = variant === 'Bg' ? BG_VARIANT_ROLE_COLLAPSE[role] ?? role : role;
    map.set(source, normalizeHex(roles[targetRole]).slice(0, 7));
  }
  return map;
}

/**
 * Перекраска SVG под палитру (однопроходная замена, без цепных подстановок)
 * + опциональный scoping id по instanceId.
 */
export function recolorSvgPure(
  rawSvg: string,
  palette: Palette | PaletteRoles,
  instanceId?: string,
  variant: ObjectVariant = 'Main'
): string {
  if (!rawSvg) return '';
  const colorMap = buildColorMap(resolvePaletteRoles(palette), variant);
  const recolored = rawSvg.replace(COLOR_DECL_REGEX, (m: string, prefix: string, hex: string) => {
    const normalized = normalizeHex(hex);
    const target = colorMap.get(normalized.slice(0, 7));
    return target ? `${prefix}${target}${normalized.slice(7)}` : m;
  });
  return instanceId ? scopeSvgIds(recolored, instanceId) : recolored;
}

/** Разбор viewBox корневого <svg> (fallback: width/height, затем fallbackSize) */
export function parseSvgViewBoxPure(svg: string, fallbackSize = 100): SvgViewBoxMetrics {
  const root = (svg || '').match(/<svg\b[^>]*>/i)?.[0] ?? '';
  const num = '([-+]?[0-9]*\\.?[0-9]+(?:[eE][-+]?[0-9]+)?)';
  const vb = root.match(
    new RegExp(`viewBox\\s*=\\s*["']\\s*${num}[\\s,]+${num}[\\s,]+${num}[\\s,]+${num}\\s*["']`, 'i')
  );
  if (vb) {
    const minX = Number(vb[1]);
    const minY = Number(vb[2]);
    const w = Number(vb[3]);
    const h = Number(vb[4]);
    if ([minX, minY, w, h].every(Number.isFinite) && w > 0 && h > 0) {
      return { minX, minY, vbWidth: w, vbHeight: h };
    }
  }
  const width = parseFloat(root.match(/\swidth\s*=\s*["']\s*([0-9.]+)/i)?.[1] ?? '');
  const height = parseFloat(root.match(/\sheight\s*=\s*["']\s*([0-9.]+)/i)?.[1] ?? '');
  return {
    minX: 0,
    minY: 0,
    vbWidth: Number.isFinite(width) && width > 0 ? width : fallbackSize,
    vbHeight: Number.isFinite(height) && height > 0 ? height : fallbackSize,
  };
}

/** Содержимое между корневыми <svg ...> и </svg>, без XML-пролога, DOCTYPE и комментариев */
export function extractSvgInner(svg: string): string {
  if (!svg) return '';
  const cleaned = svg
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const open = /<svg\b[^>]*?(\/?)>/i.exec(cleaned);
  if (!open || open[1] === '/') return '';
  const start = open.index + open[0].length;
  const end = cleaned.toLowerCase().lastIndexOf('</svg>');
  return end > start ? cleaned.slice(start, end).trim() : '';
}

/**
 * Наследуемые презентационные атрибуты корневого <svg> (fill, stroke, ...)
 * в виде строки ` name="value"`. Нужны, чтобы содержимое без корня рендерилось так же.
 */
export function readInheritedRootAttrs(svg: string): string {
  const root = (svg || '').match(/<svg\b([^>]*)>/i);
  if (!root) return '';
  const out: string[] = [];
  const attrRegex = /([A-Za-z_:][\w:.-]*)\s*=\s*(["'])([\s\S]*?)\2/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(root[1])) !== null) {
    if (INHERITED_ROOT_ATTRS.has(match[1])) {
      const value = match[3].replace(/"/g, '&quot;').replace(/</g, '&lt;');
      out.push(` ${match[1]}="${value}"`);
    }
  }
  return out.join('');
}

interface LayerContext {
  size: DetailSize;
  palette: Palette | PaletteRoles;
  svgRawMap: Record<string, string>;
}

function compileObjectLayer(obj: CanvasObject, ctx: LayerContext): string {
  const key = buildSvgRawKey(obj.illustrationId, ctx.size, obj.variant);
  const raw = ctx.svgRawMap[key] || FALLBACK_PLACEHOLDER_SVG;
  const processed = recolorSvgPure(raw, ctx.palette, obj.instanceId, obj.variant);
  const metrics = parseSvgViewBoxPure(processed);
  const inner = extractSvgInner(processed);
  const rootAttrs = readInheritedRootAttrs(processed);

  // Геометрия идентична Canvas.tsx: viewBox ассета * scale, центр viewBox -> (obj.x, obj.y)
  const scale = Number.isFinite(obj.scale) && obj.scale > 0 ? obj.scale : 1;
  const width = metrics.vbWidth * scale;
  const height = metrics.vbHeight * scale;
  const x = obj.x - width / 2;
  const y = obj.y - height / 2;

  const rotation =
    Number.isFinite(obj.rotation) && obj.rotation !== 0
      ? ` transform="rotate(${fmt(obj.rotation)} ${fmt(obj.x)} ${fmt(obj.y)})"`
      : '';
  const viewBox = `${fmt(metrics.minX)} ${fmt(metrics.minY)} ${fmt(metrics.vbWidth)} ${fmt(metrics.vbHeight)}`;

  return (
    `<g id="obj-${escapeAttr(sanitizeScope(obj.instanceId))}"` +
    ` data-illustration="${escapeAttr(String(obj.illustrationId))}"` +
    ` data-variant="${escapeAttr(String(obj.variant))}"${rotation}>` +
    `<svg x="${fmt(x)}" y="${fmt(y)}" width="${fmt(width)}" height="${fmt(height)}"` +
    ` viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" overflow="visible"${rootAttrs}>` +
    inner +
    '</svg></g>'
  );
}

/** Собирает готовый standalone SVG сцены. Чистая детерминированная функция. */
export function compileFullSvg(options: SvgCompileOptions, extras: CompileFullSvgExtras = {}): string {
  const formatConfig = CANVAS_FORMATS[options.format] ?? CANVAS_FORMATS.square;
  const width = extras.dimensions?.width ?? formatConfig.width;
  const height = extras.dimensions?.height ?? formatConfig.height;

  const ctx: LayerContext = {
    size: options.size,
    palette: extras.palette ?? options.palette,
    svgRawMap: options.svgRawMap ?? {},
  };

  // Стабильная сортировка: при равном zIndex сохраняется исходный порядок
  const layers = options.objects
    .map((obj, idx) => ({ obj, idx }))
    .sort((a, b) => a.obj.zIndex - b.obj.zIndex || a.idx - b.idx)
    .map(({ obj }) => compileObjectLayer(obj, ctx));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"` +
      ` width="${fmt(width)}" height="${fmt(height)}" viewBox="0 0 ${fmt(width)} ${fmt(height)}">`,
    `<rect x="0" y="0" width="${fmt(width)}" height="${fmt(height)}" fill="${escapeAttr(String(options.canvasBg ?? ''))}"/>`,
    ...layers,
    '</svg>',
  ].join('\n');
}
