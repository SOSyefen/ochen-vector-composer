/**
 * Обратно-совместимый фасад над src/engine.
 * Вся логика живёт в ядре; здесь — только прежние экспорты и сигнатуры.
 */
import type { CanvasFormatId, CanvasObject, IllustrationId } from '../types';
import { composeScene, isIllustrationId } from '../engine';
import type { LayoutStyle } from '../engine';

export {
  CALIBRATED_SCALES,
  COMPOSER_GRID_SIZES,
  extractComponentsFromText,
  hashString,
  ILLUSTRATION_SIZES,
  LAYOUT_STYLE_OPTIONS,
  PRESET_METAPHORS,
  resolveFallbackTheme,
  resolveSemanticTheme,
  SEMANTIC_METAPHOR_THEMES,
} from '../engine';
export type { LayoutStyle, LayoutStyleOption, PresetMetaphor, SemanticTheme } from '../engine';

/**
 * Детерминированная раскладка по явному списку компонентов (вкладка 2).
 * Пустой/невалидный список -> [] (как и раньше, без fallback-сцены).
 */
export function composeByComponentList(
  components: IllustrationId[],
  formatId: CanvasFormatId,
  layoutStyle?: LayoutStyle
): CanvasObject[] {
  if (!components.some(isIllustrationId)) return [];
  return composeScene(
    { components, format: formatId, styleOverride: layoutStyle ?? 'centered' },
    { record: true }
  ).objects;
}

/** Композиция по текстовой метафоре (вкладка 1) */
export function generateCompositionByMetaphor(
  prompt: string,
  formatId: CanvasFormatId,
  overrideStyle?: LayoutStyle
): CanvasObject[] {
  return composeScene(
    { prompt, format: formatId, styleOverride: overrideStyle || undefined },
    { record: true }
  ).objects;
}





