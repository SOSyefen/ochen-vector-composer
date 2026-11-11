import { CanvasFormatConfig, CanvasObject, Palette } from '../types';
import { buildSvgRawKey, compileFullSvg } from '../engine/pipeline/4-svgCompiler';
import { getRawSvg } from './svgRegistry';

/**
 * Собирает итоговый SVG сцены. Вся строковая сборка — в чистом ядре;
 * здесь только загрузка raw-ассетов через Vite-реестр.
 */
export function assembleFullSvg(
  objects: CanvasObject[],
  size: 'L' | 'S',
  palette: Palette,
  canvasBg: string,
  format: CanvasFormatConfig
): string {
  const svgRawMap: Record<string, string> = {};
  for (const obj of objects) {
    const key = buildSvgRawKey(obj.illustrationId, size, obj.variant);
    if (!(key in svgRawMap)) {
      svgRawMap[key] = getRawSvg(obj.illustrationId, size, obj.variant);
    }
  }

  return compileFullSvg(
    { objects, format: format.id, size, palette: palette.roles, canvasBg, svgRawMap },
    { palette, dimensions: { width: format.width, height: format.height } }
  );
}

export function downloadSvgFile(svgString: string, filename = 'ochen-composition.svg') {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
