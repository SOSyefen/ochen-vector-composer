/**
 * Самодиагностика ядра: строгие сценарии без зависимостей от тест-раннера.
 * ZERO-DOM: можно запускать в браузере (Debug Inspector), в Node и в Vitest.
 */
import type { CanvasFormatId, IllustrationId } from '../../types';
import {
  COMPOSER_GRID_SIZES,
  ENGINE_VERSION,
  HEADLINE_RIGHT_EDGE_TOLERANCE,
  PRESET_METAPHORS,
} from '../catalog';
import type {
  ComposeRequest,
  ComposeResponse,
  IntentStrategy,
  SlotRole,
  SmokeCaseResult,
  SmokeReport,
} from '../contracts';
import { composeScene } from '../compose';
import { extractComponentsFromText } from '../pipeline/1-intentParser';
import { boxesOverlap } from '../pipeline/3-spatialPlacer';
import { nowIso, nowMs } from './clock';

const SMOKE_SEED = 'engine-smoke-v1';
const EPS = 0.01;
const FORMATS: readonly CanvasFormatId[] = ['square', 'horizontal', 'vertical'];
const ACCENT_FORBIDDEN_ROLES: readonly SlotRole[] = ['tall_bg', 'free_hero', 'second_hero'];
const EXPLICIT_FOUR: readonly IllustrationId[] = ['phone', 'puzzle', 'vase', 'folder'];
const EXPLICIT_THREE: readonly IllustrationId[] = ['puzzle', 'vase', 'folder'];

class CaseContext {
  readonly failures: string[] = [];
  objectCount = 0;
  strategy: IntentStrategy | null = null;

  check(condition: boolean, message: string): void {
    if (!condition) this.failures.push(message);
  }

  compose(req: ComposeRequest): ComposeResponse {
    const res = composeScene({ seed: SMOKE_SEED, ...req }, { record: false });
    this.objectCount = res.objects.length;
    this.strategy = res.trace.intent.strategy;
    checkTraceInvariants(this, res);
    return res;
  }
}

/** Инварианты трассы, обязательные для любого результата композиции. */
function checkTraceInvariants(ctx: CaseContext, res: ComposeResponse): void {
  // Один IllustrationId не может занимать две разные роли одновременно
  const owners = new Map<IllustrationId, SlotRole>();
  for (const [role, id] of Object.entries(res.trace.roles.slots) as [SlotRole, IllustrationId | undefined][]) {
    if (id === undefined) continue;
    const previousRole = owners.get(id);
    ctx.check(
      previousRole === undefined,
      `Компонент «${id}» назначен сразу двум ролям: ${previousRole} и ${role}`
    );
    if (previousRole === undefined) owners.set(id, role);
  }
}

interface SmokeCaseDef {
  id: string;
  label: string;
  run: (ctx: CaseContext) => void;
}

function idsOf(res: ComposeResponse): IllustrationId[] {
  return res.objects.map((o) => o.illustrationId);
}

function expectContainsAll(ctx: CaseContext, res: ComposeResponse, expected: readonly IllustrationId[]): void {
  const ids = idsOf(res);
  const missing = expected.filter((id) => !ids.includes(id));
  ctx.check(missing.length === 0, `Отсутствуют объекты: ${missing.join(', ')} (есть: ${ids.join(', ')})`);
}

function expectAbsent(ctx: CaseContext, res: ComposeResponse, forbidden: IllustrationId): void {
  ctx.check(!idsOf(res).includes(forbidden), `Обнаружен лишний объект «${forbidden}»`);
}

function expectStrategy(ctx: CaseContext, res: ComposeResponse, strategy: IntentStrategy): void {
  ctx.check(
    res.trace.intent.strategy === strategy,
    `Ожидалась стратегия ${strategy}, получена ${res.trace.intent.strategy}`
  );
}

const presetCases: SmokeCaseDef[] = PRESET_METAPHORS.map((preset) => ({
  id: `preset:${preset.id}`,
  label: `Пресет «${preset.label}»`,
  run: (ctx: CaseContext) => {
    const byQuery = ctx.compose({ prompt: preset.query, format: 'square' });
    expectStrategy(ctx, byQuery, 'exact_preset');
    ctx.check(byQuery.trace.intent.matchedRuleId === preset.id, `matchedRuleId != ${preset.id}`);
    ctx.check(
      byQuery.trace.intent.resolvedStyle === preset.layoutStyle,
      `Стиль ${byQuery.trace.intent.resolvedStyle} != ${preset.layoutStyle}`
    );
    expectContainsAll(ctx, byQuery, preset.components);

    const byId = ctx.compose({ prompt: preset.id, format: 'square' });
    expectStrategy(ctx, byId, 'exact_preset');
    ctx.check(byId.trace.intent.matchedRuleId === preset.id, `Пресет не найден по id ${preset.id}`);
  },
}));

const formatCases: SmokeCaseDef[] = FORMATS.map((format) => ({
  id: `format:${format}`,
  label: `Формат ${format}: сетка, конечные координаты, уникальные id`,
  run: (ctx: CaseContext) => {
    const res = ctx.compose({ components: [...EXPLICIT_FOUR], format, styleOverride: 'centered' });
    const { W, H } = COMPOSER_GRID_SIZES[format];
    const { grid } = res.trace.spatial;
    ctx.check(grid.W === W && grid.H === H, `Сетка ${grid.W}x${grid.H} != ${W}x${H}`);
    ctx.check(res.objects.length === EXPLICIT_FOUR.length, `Ожидалось 4 объекта, есть ${res.objects.length}`);
    ctx.check(
      res.trace.spatial.objects.length === res.objects.length,
      'Трасса и ответ содержат разное число объектов'
    );
    for (const obj of res.objects) {
      const finite = [obj.x, obj.y, obj.scale].every(Number.isFinite) && obj.scale > 0;
      ctx.check(finite, `Невалидные координаты/масштаб у ${obj.illustrationId}`);
      ctx.check(
        obj.x >= -0.5 * W && obj.x <= 1.5 * W && obj.y >= -0.5 * H && obj.y <= 1.5 * H,
        `Центр ${obj.illustrationId} (${obj.x}, ${obj.y}) далеко за пределами холста`
      );
    }
    const unique = new Set(res.objects.map((o) => o.instanceId));
    ctx.check(unique.size === res.objects.length, 'Дублирующиеся instanceId');
  },
}));

const SMOKE_CASES: readonly SmokeCaseDef[] = [
  ...presetCases,
  {
    id: 'explicit:tab2-four',
    label: 'Tab 2: [phone, puzzle, vase, folder] — все 4, без lamp',
    run: (ctx) => {
      const res = ctx.compose({ components: [...EXPLICIT_FOUR], format: 'square', styleOverride: 'centered' });
      expectStrategy(ctx, res, 'explicit_components');
      expectContainsAll(ctx, res, EXPLICIT_FOUR);
      expectAbsent(ctx, res, 'lamp');
      ctx.check(res.objects.length === 4, `Ожидалось 4 объекта, есть ${res.objects.length}`);
    },
  },
  {
    id: 'explicit:tab2-three',
    label: 'Tab 2: [puzzle, vase, folder] — все 3, без lamp',
    run: (ctx) => {
      const res = ctx.compose({ components: [...EXPLICIT_THREE], format: 'square', styleOverride: 'centered' });
      expectStrategy(ctx, res, 'explicit_components');
      expectContainsAll(ctx, res, EXPLICIT_THREE);
      expectAbsent(ctx, res, 'lamp');
      ctx.check(res.objects.length === 3, `Ожидалось 3 объекта, есть ${res.objects.length}`);
    },
  },
  {
    id: 'metaphor:explicit-text',
    label: 'Текст «Смартфон, Пазл, Букет цветов, Папка» -> explicit_components',
    run: (ctx) => {
      const res = ctx.compose({ prompt: 'Смартфон, Пазл, Букет цветов, Папка', format: 'square' });
      expectStrategy(ctx, res, 'explicit_components');
      expectContainsAll(ctx, res, EXPLICIT_FOUR);
      expectAbsent(ctx, res, 'lamp');
    },
  },
  {
    id: 'edge:single-item',
    label: 'Один предмет дополняется компаньонами',
    run: (ctx) => {
      const res = ctx.compose({ components: ['phone'], format: 'square' });
      ctx.check(res.objects.length === 3, `Ожидалось 3 объекта, есть ${res.objects.length}`);
      expectContainsAll(ctx, res, ['phone']);
      ctx.check(
        res.trace.warnings.some((w) => w.includes('компаньон')),
        'Нет предупреждения о добавленных компаньонах'
      );
    },
  },
  {
    id: 'edge:six-items',
    label: '6 предметов обрезаются до <= 5',
    run: (ctx) => {
      const res = ctx.compose({
        components: ['book', 'folder', 'phone', 'puzzle', 'lamp', 'coin'],
        format: 'square',
      });
      ctx.check(res.trace.roles.normalizedComponents.length <= 5, 'normalizedComponents > 5');
      ctx.check(res.objects.length <= 5, `Объектов больше 5: ${res.objects.length}`);
      ctx.check(res.trace.roles.droppedComponents.includes('coin'), 'Самый лёгкий (coin) не отброшен');
      ctx.check(res.trace.warnings.some((w) => w.includes('лимит')), 'Нет предупреждения о лимите');
    },
  },
  {
    id: 'edge:yo-normalization',
    label: 'Нормализация «ё» -> «е»',
    run: (ctx) => {
      const single = extractComponentsFromText('Кошелёк');
      ctx.check(single.length === 1 && single[0] === 'notebook', `«Кошелёк» -> [${single.join(', ')}]`);
      const res = ctx.compose({ prompt: 'Кошелёк и монетка на столе', format: 'square' });
      expectStrategy(ctx, res, 'explicit_components');
      const extracted = res.trace.intent.extractedExplicit;
      ctx.check(
        extracted.includes('notebook') && extracted.includes('coin'),
        `Извлечено: [${extracted.join(', ')}]`
      );
    },
  },
  {
    id: 'edge:english-synonyms',
    label: 'Английские синонимы',
    run: (ctx) => {
      const res = ctx.compose({ prompt: 'Headphones, a book and a pen', format: 'square' });
      expectStrategy(ctx, res, 'explicit_components');
      expectContainsAll(ctx, res, ['headphones', 'book', 'pen']);
    },
  },
  {
    id: 'semantic:cozy',
    label: 'Семантическая тема «Осенний вечер» -> cozy',
    run: (ctx) => {
      const res = ctx.compose({ prompt: 'Осенний вечер', format: 'square' });
      expectStrategy(ctx, res, 'semantic_theme');
      ctx.check(res.trace.intent.matchedRuleId === 'cozy', `Тема: ${res.trace.intent.matchedRuleId}`);
      ctx.check(res.objects.length > 0, 'Пустая сцена');
    },
  },
  {
    id: 'edge:empty-input',
    label: 'Пустой запрос -> детерминированный fallback',
    run: (ctx) => {
      const res = ctx.compose({ prompt: '', format: 'square' });
      expectStrategy(ctx, res, 'deterministic_fallback');
      ctx.check(res.objects.length > 0, 'Fallback-сцена пуста');
    },
  },
  ...formatCases,
  {
    id: 'layout:headline-right-edge',
    label: `Headline: правая граница <= W + ${HEADLINE_RIGHT_EDGE_TOLERANCE} во всех форматах`,
    run: (ctx) => {
      for (const format of FORMATS) {
        const res = ctx.compose({ prompt: 'headline-article', format });
        const { W } = COMPOSER_GRID_SIZES[format];
        ctx.check(res.trace.intent.resolvedStyle === 'headline', `[${format}] стиль не headline`);
        ctx.check(res.trace.spatial.grid.xShift > 0, `[${format}] нет смещения под заголовок`);
        const maxRight = Math.max(...res.trace.spatial.items.map((i) => i.aabb.right));
        ctx.check(
          maxRight <= W + HEADLINE_RIGHT_EDGE_TOLERANCE + EPS,
          `[${format}] правая граница ${maxRight} > ${W + HEADLINE_RIGHT_EDGE_TOLERANCE}`
        );
      }
    },
  },
  {
    id: 'determinism:seed',
    label: 'Детерминизм при одинаковом seed',
    run: (ctx) => {
      const req: ComposeRequest = {
        prompt: 'Смартфон, Пазл, Букет цветов, Папка',
        format: 'square',
        seed: 'determinism',
      };
      const a = ctx.compose(req);
      const b = ctx.compose(req);
      ctx.check(JSON.stringify(a.objects) === JSON.stringify(b.objects), 'objects различаются');
      ctx.check(
        JSON.stringify(a.trace.spatial.items) === JSON.stringify(b.trace.spatial.items),
        'spatial.items различаются'
      );
      ctx.check(a.trace.traceId === b.trace.traceId, 'traceId различаются');
      const c = ctx.compose({ ...req, seed: 'determinism-other' });
      ctx.check(
        a.objects.length > 0 && a.objects[0].instanceId !== c.objects[0]?.instanceId,
        'Разные seed дали одинаковые instanceId'
      );
    },
  },
  {
    id: 'spatial:accent-collision',
    label: 'Акцент не пересекается с tall_bg / free_hero / second_hero',
    run: (ctx) => {
      const res = ctx.compose({ prompt: 'music-focus', format: 'square' });
      const { items, accentCollisionTrace } = res.trace.spatial;
      const accent = items.find((i) => i.role === 'small_accent');
      ctx.check(accent !== undefined, 'Нет акцента в сцене');
      ctx.check(accentCollisionTrace.length > 0, 'Пустая трасса коллизий');
      const last = accentCollisionTrace[accentCollisionTrace.length - 1];
      ctx.check(last !== undefined && last.collidedWith === null, `Остаточная коллизия: ${last?.collidedWith}`);
      if (accent) {
        for (const zone of items.filter((i) => ACCENT_FORBIDDEN_ROLES.includes(i.role))) {
          ctx.check(
            !boxesOverlap(accent.aabb, zone.aabb, 0),
            `Акцент пересекается с ${zone.illustrationId} (${zone.role})`
          );
        }
      }
    },
  },
];

function runCase(def: SmokeCaseDef): SmokeCaseResult {
  const ctx = new CaseContext();
  const startedAt = nowMs();
  try {
    def.run(ctx);
  } catch (err) {
    ctx.failures.push(`Исключение: ${err instanceof Error ? err.message : String(err)}`);
  }
  return {
    id: def.id,
    label: def.label,
    passed: ctx.failures.length === 0,
    failures: ctx.failures,
    durationMs: Number((nowMs() - startedAt).toFixed(3)),
    objectCount: ctx.objectCount,
    strategy: ctx.strategy,
  };
}

export function runEngineSmokeSuite(): SmokeReport {
  const startedAt = nowMs();
  const timestampIso = nowIso();
  const cases = SMOKE_CASES.map(runCase);
  const passed = cases.filter((c) => c.passed).length;
  return {
    engineVersion: ENGINE_VERSION,
    timestampIso,
    total: cases.length,
    passed,
    failed: cases.length - passed,
    durationMs: Number((nowMs() - startedAt).toFixed(3)),
    cases,
  };
}
