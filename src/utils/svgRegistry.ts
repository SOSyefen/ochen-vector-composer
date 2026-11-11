import { DetailSize, IllustrationCatalogItem, IllustrationId, ObjectVariant } from '../types';

export const BASE_OBJECT_SIZE = 300;

export const ILLUSTRATION_CATALOG: readonly IllustrationCatalogItem[] = [
  { id: 'book', label: 'Книга', category: 'study', visualWeight: 1.1 },
  { id: 'phone', label: 'Смартфон', category: 'tech', visualWeight: 0.95 },
  { id: 'puzzle', label: 'Пазл', category: 'creative', visualWeight: 0.9 },
  { id: 'coin', label: 'Монета', category: 'finance', visualWeight: 0.75 },
  { id: 'headphones', label: 'Наушники', category: 'tech', visualWeight: 1.05 },
  { id: 'lamp', label: 'Лампа', category: 'work', visualWeight: 1.0 },
  { id: 'vase', label: 'Ваза', category: 'creative', visualWeight: 0.85 },
  { id: 'notebook', label: 'Блокнот', category: 'work', visualWeight: 0.9 },
  { id: 'folder', label: 'Папка', category: 'work', visualWeight: 1.0 },
  { id: 'pen', label: 'Ручка', category: 'work', visualWeight: 0.7 },
];

export interface SvgMetrics {
  minX: number;
  minY: number;
  vbWidth: number;
  vbHeight: number;
}

// Vite imports all raw SVG files at build time
const rawSvgMap: Record<string, string> = import.meta.glob(
  '/src/assets/illustrations/*.svg',
  { query: '?raw', import: 'default', eager: true }
);

export function getSvgAssetKey(
  id: IllustrationId,
  size: DetailSize,
  variant: ObjectVariant
): string {
  return `/src/assets/illustrations/${size}_${variant}_${id}.svg`;
}

export function getRawSvg(
  id: IllustrationId,
  size: DetailSize,
  variant: ObjectVariant
): string {
  const key = getSvgAssetKey(id, size, variant);
  const found = rawSvgMap[key];
  if (found) return found;

  // Fallback if not found
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#ccc"/></svg>`;
}

export function parseSvgViewBox(svgContent: string): SvgMetrics {
  const match = svgContent.match(/viewBox=["']\s*([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s*["']/i);
  if (match) {
    return {
      minX: parseFloat(match[1]) || 0,
      minY: parseFloat(match[2]) || 0,
      vbWidth: parseFloat(match[3]) || BASE_OBJECT_SIZE,
      vbHeight: parseFloat(match[4]) || BASE_OBJECT_SIZE,
    };
  }
  return { minX: 0, minY: 0, vbWidth: BASE_OBJECT_SIZE, vbHeight: BASE_OBJECT_SIZE };
}
