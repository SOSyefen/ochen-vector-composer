/**
 * Строгие контракты пайплайна композиции.
 * ZERO-DOM: модуль не должен зависеть от window/document и UI-слоя.
 */
import {
  CanvasFormatId,
  CanvasObject,
  DetailSize,
  IllustrationId,
  ObjectVariant,
  PaletteRoles,
} from '../types';
import { LayoutStyle } from './catalog';

export type IntentStrategy =
  | 'exact_preset'
  | 'explicit_components'
  | 'preset_keyword'
  | 'semantic_theme'
  | 'deterministic_fallback';

export type SlotRole =
  | 'tall_bg'
  | 'flat_base'
  | 'primary_stack'
  | 'secondary_stack'
  | 'free_hero'
  | 'second_hero'
  | 'small_accent';

export interface AABB {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ComposeRequest {
  prompt?: string;
  components?: IllustrationId[];
  format: CanvasFormatId;
  styleOverride?: LayoutStyle;
  /** Для 100% воспроизводимых instanceId в тестах и CLI */
  seed?: string;
}

/** Шаг 1: Результат семантического разбора */
export interface IntentResolution {
  strategy: IntentStrategy;
  matchedRuleId: string | null;
  extractedExplicit: IllustrationId[];
  rawComponents: IllustrationId[];
  resolvedStyle: LayoutStyle;
}

/** Шаг 2: Результат назначения ролей и слотов */
export interface RoleAssignment {
  normalizedComponents: IllustrationId[];
  droppedComponents: IllustrationId[];
  slots: Partial<Record<SlotRole, IllustrationId>>;
}

/** Шаг 3: Трассировка геометрии и разрешения коллизий */
export interface CollisionStep {
  iteration: number;
  gx: number;
  gy: number;
  collidedWith: IllustrationId | null;
}

export interface PlacedItemTrace {
  illustrationId: IllustrationId;
  role: SlotRole;
  variant: ObjectVariant;
  zIndex: number;
  scale: number;
  initialCoords: { gx: number; gy: number };
  finalCoords: { gx: number; gy: number };
  aabb: AABB;
  /** Сдвиг по X, применённый headline-клампингом (<= 0) */
  headlineShiftApplied: number;
}

export interface SpatialPlacementResult {
  grid: { W: number; H: number; scaleRatio: number; xShift: number };
  items: PlacedItemTrace[];
  accentCollisionTrace: CollisionStep[];
  objects: CanvasObject[];
}

/** Полный слепок выполнения пайплайна для Debug Inspector и тестов */
export interface PipelineTrace {
  traceId: string;
  timestampIso: string;
  durationMs: number;
  request: ComposeRequest;
  intent: IntentResolution;
  roles: RoleAssignment;
  spatial: SpatialPlacementResult;
  warnings: string[];
}

export interface ComposeResponse {
  objects: CanvasObject[];
  trace: PipelineTrace;
}

/** Опциональный Шаг 4: Headless компиляция в готовый SVG без браузера */
export interface SvgCompileOptions {
  objects: CanvasObject[];
  format: CanvasFormatId;
  size: DetailSize;
  palette: PaletteRoles;
  canvasBg: string;
  /** key: `${id}_${size}_${variant}` */
  svgRawMap: Record<string, string>;
}

/** Результат одного кейса самодиагностики */
export interface SmokeCaseResult {
  id: string;
  label: string;
  passed: boolean;
  failures: string[];
  durationMs: number;
  objectCount: number;
  strategy: IntentStrategy | null;
}

/** Сводный отчёт самодиагностики ядра */
export interface SmokeReport {
  engineVersion: string;
  timestampIso: string;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  cases: SmokeCaseResult[];
}
