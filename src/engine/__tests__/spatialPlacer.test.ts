import { describe, expect, it } from 'vitest';
import type { CanvasFormatId, IllustrationId } from '../../types';
import {
  COMPOSER_GRID_SIZES,
  HEADLINE_RIGHT_EDGE_TOLERANCE,
  ILLUSTRATION_SIZES,
} from '../catalog';
import type { PlacedItemTrace, SlotRole, SpatialPlacementResult } from '../contracts';
import { resolveRoles } from '../pipeline/2-roleResolver';
import {
  boxesOverlap,
  getFormatScaleRatio,
  getGridBox,
  placeScene,
} from '../pipeline/3-spatialPlacer';

const FORMATS: CanvasFormatId[] = ['square', 'horizontal', 'vertical'];

function itemOf(res: SpatialPlacementResult, id: IllustrationId): PlacedItemTrace {
  const item = res.items.find((i) => i.illustrationId === id);
  if (!item) throw new Error(`item ${id} not placed`);
  return item;
}

describe('getFormatScaleRatio', () => {
  it('square = 1', () => {
    expect(getFormatScaleRatio('square')).toBe(1);
  });

  it('horizontal ограничен высотой', () => {
    expect(getFormatScaleRatio('horizontal')).toBeCloseTo(Math.min(450 / 380, (250 / 380) * 1.25), 6);
  });

  it('vertical = W/380 * 1.05', () => {
    expect(getFormatScaleRatio('vertical')).toBeCloseTo((250 / 380) * 1.05, 6);
  });
});

describe('getGridBox / boxesOverlap', () => {
  it('AABB центрирован относительно точки', () => {
    const box = getGridBox('coin', 100, 50, 1);
    const [w, h] = ILLUSTRATION_SIZES.coin;
    expect(box.right - box.left).toBeCloseTo(w, 6);
    expect(box.bottom - box.top).toBeCloseTo(h, 6);
    expect((box.left + box.right) / 2).toBeCloseTo(100, 6);
    expect((box.top + box.bottom) / 2).toBeCloseTo(50, 6);
  });

  it('учитывает margin', () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 };
    const b = { left: 15, top: 0, right: 25, bottom: 10 };
    expect(boxesOverlap(a, b, 0)).toBe(false);
    expect(boxesOverlap(a, b, 10)).toBe(true);
  });
});

describe('placeScene', () => {
  it('пустые слоты -> пустая сцена', () => {
    const res = placeScene(
      { normalizedComponents: [], droppedComponents: [], slots: {} },
      'square',
      'centered',
      'x'
    );
    expect(res.objects).toEqual([]);
    expect(res.items).toEqual([]);
    expect(res.grid).toMatchObject({ W: 380, H: 380 });
  });

  it('неизвестный формат -> square', () => {
    const res = placeScene(resolveRoles(['headphones', 'vase', 'coin']), 'weird' as CanvasFormatId, 'centered', 's');
    expect(res.grid).toMatchObject({ W: 380, H: 380 });
  });

  it('политика вариантов и zIndex', () => {
    const res = placeScene(resolveRoles(['headphones', 'vase', 'coin']), 'square', 'centered', 'seed');
    expect(itemOf(res, 'vase')).toMatchObject({ role: 'tall_bg', variant: 'Bg', zIndex: 1 });
    expect(itemOf(res, 'headphones')).toMatchObject({ role: 'free_hero', variant: 'Main', zIndex: 15 });
    expect(itemOf(res, 'coin')).toMatchObject({ role: 'small_accent', variant: 'Main', zIndex: 8 });
    expect(res.objects.filter((o) => o.variant === 'Bg')).toHaveLength(1);
  });

  it('стек на подложке: zIndex 2 / 10 / 11', () => {
    const res = placeScene(resolveRoles(['book', 'phone', 'pen']), 'square', 'centered', 'seed');
    expect(itemOf(res, 'book')).toMatchObject({ role: 'flat_base', zIndex: 2 });
    expect(itemOf(res, 'phone')).toMatchObject({ role: 'primary_stack', zIndex: 10 });
    expect(itemOf(res, 'pen')).toMatchObject({ role: 'secondary_stack', zIndex: 11 });
  });

  it('геометрия tall_bg (centered, square)', () => {
    const res = placeScene(resolveRoles(['headphones', 'vase', 'coin']), 'square', 'centered', 'seed');
    const vase = itemOf(res, 'vase');
    expect(vase.finalCoords.gx).toBeCloseTo(0.28 * 380, 1);
    expect(vase.finalCoords.gy).toBeCloseTo(-0.12 * 380 + (748.5 * 0.25) / 2, 1);
  });

  it('offset меняет позицию tall_bg', () => {
    const roles = resolveRoles(['headphones', 'vase', 'coin']);
    const centered = placeScene(roles, 'square', 'centered', 's');
    const offset = placeScene(roles, 'square', 'offset', 's');
    expect(itemOf(offset, 'vase').finalCoords).not.toEqual(itemOf(centered, 'vase').finalCoords);
  });

  it('детерминизм при одинаковом seed', () => {
    const roles = resolveRoles(['phone', 'puzzle', 'vase', 'folder']);
    const a = placeScene(roles, 'horizontal', 'centered', 'seed-1');
    const b = placeScene(roles, 'horizontal', 'centered', 'seed-1');
    expect(a).toEqual(b);

    const c = placeScene(roles, 'horizontal', 'centered', 'seed-2');
    expect(c.objects.map((o) => o.instanceId)).not.toEqual(a.objects.map((o) => o.instanceId));
    expect(c.items).toEqual(a.items);
  });

  it('objects соответствуют finalCoords трассы', () => {
    for (const format of FORMATS) {
      const res = placeScene(resolveRoles(['phone', 'puzzle', 'vase', 'folder']), format, 'centered', 'k');
      expect(res.objects).toHaveLength(res.items.length);
      res.objects.forEach((obj, idx) => {
        expect(obj.x).toBeCloseTo(res.items[idx].finalCoords.gx, 0);
        expect(obj.y).toBeCloseTo(res.items[idx].finalCoords.gy, 0);
        expect(Number.isFinite(obj.scale) && obj.scale > 0).toBe(true);
      });
    }
  });

  it.each(FORMATS)('headline: правая граница <= W + допуск (%s)', (format) => {
    const res = placeScene(resolveRoles(['headphones', 'folder', 'pen']), format, 'headline', 'h');
    const { W } = COMPOSER_GRID_SIZES[format];
    const maxRight = Math.max(...res.items.map((i) => i.aabb.right));
    expect(maxRight).toBeLessThanOrEqual(W + HEADLINE_RIGHT_EDGE_TOLERANCE + 0.01);
    expect(res.grid.xShift).toBeGreaterThan(0);

    const shifts = new Set(res.items.map((i) => i.headlineShiftApplied));
    expect(shifts.size).toBe(1);
    expect([...shifts][0]).toBeLessThanOrEqual(0);

    // Сдвиг равномерный: смещение pen относительно folder сохраняется
    const dx = itemOf(res, 'pen').finalCoords.gx - itemOf(res, 'folder').finalCoords.gx;
    expect(dx).toBeCloseTo(0.09 * W, 1);
  });

  it('акцент выталкивается из запрещённых зон', () => {
    const res = placeScene(resolveRoles(['headphones', 'vase', 'coin']), 'square', 'centered', 'a');
    const accent = itemOf(res, 'coin');
    expect(accent.initialCoords).toEqual({ gx: 83.6, gy: 296.4 });
    expect(res.accentCollisionTrace.length).toBeGreaterThan(1);
    expect(res.accentCollisionTrace[0].collidedWith).toBe('headphones');
    expect(res.accentCollisionTrace[res.accentCollisionTrace.length - 1].collidedWith).toBeNull();

    const forbidden: SlotRole[] = ['tall_bg', 'free_hero', 'second_hero'];
    for (const zone of res.items.filter((i) => forbidden.includes(i.role))) {
      expect(boxesOverlap(accent.aabb, zone.aabb, 0)).toBe(false);
    }
  });

  it('second_hero без подложки (cafe)', () => {
    const res = placeScene(resolveRoles(['notebook', 'phone', 'vase', 'coin']), 'square', 'centered', 'c');
    expect(itemOf(res, 'notebook')).toMatchObject({ role: 'free_hero', zIndex: 15 });
    expect(itemOf(res, 'phone')).toMatchObject({ role: 'second_hero', zIndex: 14 });
  });
});
