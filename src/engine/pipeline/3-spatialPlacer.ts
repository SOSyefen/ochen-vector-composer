/**
 * Шаг 3 пайплайна: пространственная раскладка и разрешение коллизий.
 * ZERO-DOM: чистые функции; при наличии seed результат полностью детерминирован.
 *
 * Политика вариантов (3–4 цветных "Main" + ровно один монохромный "Bg"):
 *   - tall_bg          -> "Bg"   zIndex 1
 *   - flat_base        -> "Main" zIndex 2
 *   - small_accent     -> "Main" zIndex 8
 *   - primary_stack    -> "Main" zIndex 10
 *   - secondary_stack  -> "Main" zIndex 11
 *   - second_hero      -> "Main" zIndex 14
 *   - free_hero        -> "Main" zIndex 15
 */
import { CanvasFormatId, CanvasObject, IllustrationId, ObjectVariant } from '../../types';
import {
  BASE_SQUARE_SIDE,
  CALIBRATED_SCALES,
  COMPOSER_GRID_SIZES,
  HEADLINE_RIGHT_EDGE_TOLERANCE,
  HEADLINE_SAFE_ZONE_RATIO,
  ILLUSTRATION_SIZES,
  LayoutStyle,
} from '../catalog';
import {
  AABB,
  CollisionStep,
  PlacedItemTrace,
  RoleAssignment,
  SlotRole,
  SpatialPlacementResult,
} from '../contracts';
import { hashString } from './1-intentParser';

const MAX_ACCENT_ITERATIONS = 16;
const ACCENT_COLLISION_MARGIN = 8;

interface WorkingPlacement {
  illustrationId: IllustrationId;
  role: SlotRole;
  variant: ObjectVariant;
  initialGx: number;
  initialGy: number;
  gx: number;
  gy: number;
  gridScale: number;
  rotation: number;
  zIndex: number;
  headlineShift: number;
}

interface ForbiddenZone {
  id: IllustrationId;
  box: AABB;
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function resolveFormat(format: CanvasFormatId): CanvasFormatId {
  return Object.prototype.hasOwnProperty.call(COMPOSER_GRID_SIZES, format) ? format : 'square';
}

export function getFormatScaleRatio(formatId: CanvasFormatId): number {
  const { W, H } = COMPOSER_GRID_SIZES[formatId];
  if (formatId === 'horizontal') {
    // Blend H/380 and W/380 so objects fit 250px height without shrinking excessively
    return Math.min(W / BASE_SQUARE_SIDE, (H / BASE_SQUARE_SIDE) * 1.25);
  }
  if (formatId === 'vertical') {
    // Hero still occupies ~70-75% of narrow 250px width
    return (W / BASE_SQUARE_SIDE) * 1.05;
  }
  return W / BASE_SQUARE_SIDE;
}

export function getGridBox(id: IllustrationId, gx: number, gy: number, gridScale: number): AABB {
  const [vbW, vbH] = ILLUSTRATION_SIZES[id];
  const halfW = (vbW * gridScale) / 2;
  const halfH = (vbH * gridScale) / 2;
  return {
    left: gx - halfW,
    top: gy - halfH,
    right: gx + halfW,
    bottom: gy + halfH,
  };
}

export function boxesOverlap(a: AABB, b: AABB, margin = 10): boolean {
  return !(
    a.right + margin <= b.left ||
    a.left - margin >= b.right ||
    a.bottom + margin <= b.top ||
    a.top - margin >= b.bottom
  );
}

/**
 * Выталкивает акцент за пределы запрещённых AABB (tall_bg, free_hero, second_hero)
 * в нижне-левую свободную зону, логируя каждую итерацию.
 */
function resolveSafeAccentCoords(
  accentId: IllustrationId,
  accentScale: number,
  targetGx: number,
  targetGy: number,
  forbidden: readonly ForbiddenZone[],
  H: number,
  xShift: number,
  trace: CollisionStep[]
): { gx: number; gy: number } {
  const [vbW, vbH] = ILLUSTRATION_SIZES[accentId];
  const halfW = (vbW * accentScale) / 2;
  const halfH = (vbH * accentScale) / 2;

  const minX = Math.max(halfW * 0.65, xShift * 0.5 + halfW * 0.5);
  const maxY = H - halfH * 0.6;
  const minY = halfH * 0.5;
  // maxY имеет приоритет, если холст слишком низкий и границы инвертированы
  const clampY = (value: number): number => Math.min(maxY, Math.max(minY, value));

  let gx = targetGx;
  let gy = clampY(targetGy);

  const findCollision = (): ForbiddenZone | undefined => {
    const candidate = getGridBox(accentId, gx, gy, accentScale);
    return forbidden.find((zone) => boxesOverlap(candidate, zone.box, ACCENT_COLLISION_MARGIN));
  };

  for (let step = 0; step < MAX_ACCENT_ITERATIONS; step++) {
    const colliding = findCollision();
    trace.push({
      iteration: step,
      gx: round(gx),
      gy: round(gy),
      collidedWith: colliding ? colliding.id : null,
    });
    if (!colliding) {
      return { gx, gy };
    }

    const pushLeft = colliding.box.left - halfW - 12;
    const pushDown = colliding.box.bottom + halfH + 10;

    if (pushLeft >= minX) {
      gx = pushLeft;
    } else if (pushDown <= maxY) {
      gy = pushDown;
    } else {
      gx = Math.max(halfW * 0.5, gx - 14);
      gy = clampY(gy + 10);
    }
  }

  // Жёсткий зажим по вертикали: акцент не выходит за холст даже после каскада из 16 итераций
  gy = clampY(gy);

  // Итоговая позиция после исчерпания итераций (может остаться коллизия)
  const residual = findCollision();
  trace.push({
    iteration: MAX_ACCENT_ITERATIONS,
    gx: round(gx),
    gy: round(gy),
    collidedWith: residual ? residual.id : null,
  });
  return { gx, gy };
}

function buildInstanceId(
  item: WorkingPlacement,
  idx: number,
  seed: string | undefined,
  stamp: number
): string {
  if (seed !== undefined) {
    const h = hashString(`${seed}:${idx}:${item.illustrationId}:${item.role}`).toString(36);
    return `${item.illustrationId}-${h}-${idx}`;
  }
  return `${item.illustrationId}-${stamp}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
}

export function placeScene(
  roles: RoleAssignment,
  format: CanvasFormatId,
  style: LayoutStyle,
  seed?: string
): SpatialPlacementResult {
  const formatId = resolveFormat(format);
  const { W, H } = COMPOSER_GRID_SIZES[formatId];
  const scaleRatio = getFormatScaleRatio(formatId);
  const xShift = style === 'headline' ? HEADLINE_SAFE_ZONE_RATIO * W : 0;

  const grid = { W, H, scaleRatio: round(scaleRatio, 4), xShift: round(xShift) };
  const accentCollisionTrace: CollisionStep[] = [];

  const { slots } = roles;
  if (Object.keys(slots).length === 0) {
    return { grid, items: [], accentCollisionTrace, objects: [] };
  }

  const scaleOf = (id: IllustrationId, fallback: number): number =>
    (CALIBRATED_SCALES[id] || fallback) * scaleRatio;

  const placed: WorkingPlacement[] = [];
  const place = (
    illustrationId: IllustrationId,
    role: SlotRole,
    variant: ObjectVariant,
    gx: number,
    gy: number,
    gridScale: number,
    zIndex: number
  ): void => {
    placed.push({
      illustrationId,
      role,
      variant,
      initialGx: gx,
      initialGy: gy,
      gx,
      gy,
      gridScale,
      rotation: 0,
      zIndex,
      headlineShift: 0,
    });
  };

  // Зоны, которых акцент обязан избегать. Подложка и стек исключены намеренно:
  // акцент лежит перед нижним левым углом подложки.
  const accentForbidden: ForbiddenZone[] = [];

  // 1. Tall background -> монохромный "Bg", нижний слой
  const tallId = slots.tall_bg;
  if (tallId) {
    const scale = scaleOf(tallId, 0.25);
    const [, vbH] = ILLUSTRATION_SIZES[tallId];
    const gx = (style === 'offset' ? 0.20 * W : 0.28 * W) + xShift;
    // Верхний край на -0.12 * H => центр Y = -0.12 * H + (vbH * scale) / 2
    const gy = style === 'offset' ? 0.10 * H : -0.12 * H + (vbH * scale) / 2;
    place(tallId, 'tall_bg', 'Bg', gx, gy, scale, 1);
    accentForbidden.push({ id: tallId, box: getGridBox(tallId, gx, gy, scale) });
  }

  // 2. Base (folder / book) + stacked items
  const baseId = slots.flat_base;
  if (baseId) {
    const baseScale = scaleOf(baseId, 0.28);
    place(baseId, 'flat_base', 'Main', 0.35 * W + xShift, 0.55 * H, baseScale, 2);

    const primaryStackId = slots.primary_stack;
    if (primaryStackId) {
      const sScale = scaleOf(primaryStackId, 0.28);
      place(primaryStackId, 'primary_stack', 'Main', 0.38 * W + xShift, 0.58 * H, sScale, 10);
    }

    const secondaryStackId = slots.secondary_stack;
    if (secondaryStackId) {
      const penScale = scaleOf(secondaryStackId, 0.28);
      place(secondaryStackId, 'secondary_stack', 'Main', 0.44 * W + xShift, 0.42 * H, penScale, 11);
    }
  }

  // 3. Free hero
  const freeHeroId = slots.free_hero;
  if (freeHeroId) {
    const scale = scaleOf(freeHeroId, 0.32);
    const gx = (style === 'offset' ? 0.65 * W : 0.62 * W) + xShift;
    const gy = style === 'offset' ? 0.55 * H : 0.65 * H;
    place(freeHeroId, 'free_hero', 'Main', gx, gy, scale, 15);
    accentForbidden.push({ id: freeHeroId, box: getGridBox(freeHeroId, gx, gy, scale) });
  }

  // 3b. Second hero (без подложки, например cafe: phone рядом с notebook)
  const secondHeroId = slots.second_hero;
  if (secondHeroId) {
    const scale = scaleOf(secondHeroId, 0.28);
    const gx = 0.34 * W + xShift;
    const gy = 0.52 * H;
    place(secondHeroId, 'second_hero', 'Main', gx, gy, scale, 14);
    accentForbidden.push({ id: secondHeroId, box: getGridBox(secondHeroId, gx, gy, scale) });
  }

  // 4. Accent (coin / pen) -> "Main", нижний левый угол
  const accentId = slots.small_accent;
  if (accentId) {
    const scale = scaleOf(accentId, 0.32);
    const targetGx = (baseId ? 0.20 : 0.22) * W + xShift;
    const targetGy = baseId ? 0.78 * H : style === 'offset' ? 0.80 * H : 0.78 * H;

    const safe = resolveSafeAccentCoords(
      accentId,
      scale,
      targetGx,
      targetGy,
      accentForbidden,
      H,
      xShift,
      accentCollisionTrace
    );
    place(accentId, 'small_accent', 'Main', safe.gx, safe.gy, scale, 8);
    // initialCoords акцента — целевая точка до разрешения коллизий
    const accent = placed[placed.length - 1];
    accent.initialGx = targetGx;
    accent.initialGy = targetGy;
  }

  // Headline: правая граница <= W + 10, вся группа сдвигается равномерно,
  // чтобы стек сохранял точные смещения относительно подложки.
  if (style === 'headline' && placed.length > 0) {
    const maxRight = Math.max(
      ...placed.map((p) => p.gx + (ILLUSTRATION_SIZES[p.illustrationId][0] * p.gridScale) / 2)
    );
    const overflow = maxRight - (W + HEADLINE_RIGHT_EDGE_TOLERANCE);
    if (overflow > 0) {
      for (const p of placed) {
        p.gx -= overflow;
        p.headlineShift = -overflow;
      }
    }
  }

  // ---- Trace & projection onto CanvasObject[] ------------------------------
  const items: PlacedItemTrace[] = placed.map((p) => ({
    illustrationId: p.illustrationId,
    role: p.role,
    variant: p.variant,
    zIndex: p.zIndex,
    scale: round(p.gridScale),
    initialCoords: { gx: round(p.initialGx), gy: round(p.initialGy) },
    finalCoords: { gx: round(p.gx), gy: round(p.gy) },
    aabb: (() => {
      const box = getGridBox(p.illustrationId, p.gx, p.gy, p.gridScale);
      return {
        left: round(box.left),
        top: round(box.top),
        right: round(box.right),
        bottom: round(box.bottom),
      };
    })(),
    headlineShiftApplied: round(p.headlineShift),
  }));

  const stamp = seed !== undefined ? 0 : Date.now();
  const objects: CanvasObject[] = placed.map((item, idx) => ({
    instanceId: buildInstanceId(item, idx, seed, stamp),
    illustrationId: item.illustrationId,
    variant: item.variant,
    x: Number(item.gx.toFixed(1)),
    y: Number(item.gy.toFixed(1)),
    scale: Number(item.gridScale.toFixed(2)),
    rotation: item.rotation,
    zIndex: item.zIndex,
  }));

  return { grid, items, accentCollisionTrace, objects };
}
