import { CanvasFormatConfig, CanvasObject, Palette } from '../types';
import { getRawSvg, parseSvgViewBox } from './svgRegistry';
import { recolorSvg } from './recolorEngine';

export function assembleFullSvg(
  objects: CanvasObject[],
  size: 'L' | 'S',
  palette: Palette,
  canvasBg: string,
  format: CanvasFormatConfig
): string {
  // Sort objects by zIndex
  const sorted = [...objects].sort((a, b) => a.zIndex - b.zIndex);

  const innerSvgElements: string[] = [];

  for (const obj of sorted) {
    const raw = getRawSvg(obj.illustrationId, size, obj.variant);
    const recolored = recolorSvg(raw, palette, obj.instanceId);
    const metrics = parseSvgViewBox(raw);

    // Extract content inside <svg> ... </svg>
    const match = recolored.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
    const innerContent = match ? match[1] : '';

    // Center of object transform
    const originX = metrics.vbWidth / 2;
    const originY = metrics.vbHeight / 2;

    const transform = `translate(${obj.x - originX * obj.scale}, ${obj.y - originY * obj.scale}) scale(${obj.scale}) rotate(${obj.rotation} ${originX} ${originY})`;

    innerSvgElements.push(`
    <!-- Object: ${obj.illustrationId} (${obj.variant}) [id: ${obj.instanceId}] -->
    <g id="${obj.instanceId}" transform="${transform}">
      ${innerContent}
    </g>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${format.width} ${format.height}" width="${format.width}" height="${format.height}">
  <defs>
    <style>
      /* Clean Studio Ochen Vector Export */
      * { box-sizing: border-box; }
    </style>
  </defs>
  <!-- Canvas Background: strict palette-compliant -->
  <rect width="${format.width}" height="${format.height}" fill="${canvasBg}" />
  
  <!-- Composition Elements -->
  <g id="composition_layer">
    ${innerSvgElements.join('\n')}
  </g>
</svg>`;
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
